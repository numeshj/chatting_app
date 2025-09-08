const WebSocket = require('ws');
const PORT = process.env.PORT || 3001;
const wss = new WebSocket.Server({ port: PORT });

const users = new Map(); // id -> { name, ws }
const messages = new Map(); // conversationKey -> [payload]

function getConversationKey(id1, id2) {
  return [id1, id2].sort().join('-');
}

function buildConversationSummaries(forUserId) {
  const summaries = [];
  for (const [convKey, list] of messages.entries()) {
    if (convKey.split('-').map(Number).includes(forUserId) && list.length) {
      const last = list[list.length - 1];
      const otherId = last.source.id === forUserId ? last.destination : last.source.id;
      let otherName;
      if (last.source.id !== forUserId) {
        otherName = last.source.name;
      } else {
        const found = list.find(m => m.source.id === otherId);
        otherName = found ? found.source.name : `User${otherId}`;
      }
      summaries.push({
        with: { id: otherId, name: otherName },
        lastMessage: last
      });
    }
  }
  return summaries;
}

wss.on('connection', (ws) => {
  let userId = null;
  let userName = null;

  ws.on('message', (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (e) {
      return;
    }

    if (data.type === 'connect') {
      const requestedId = parseInt(data.id);
      const requestedName = data.name || `User${requestedId}`;
      if (users.has(requestedId)) {
        // (allow multi-login by taking over)
        try {
          const prev = users.get(requestedId);
          if (prev && prev.ws && prev.ws.readyState === WebSocket.OPEN) {
            try { prev.ws.send(JSON.stringify({ type: 'session-replaced' })); } catch {}
            try { prev.ws.close(4001, 'Session replaced'); } catch {}
          }
        } catch {}
        users.delete(requestedId); // ensure clean slate
      }
      userId = requestedId;
      userName = requestedName;
      users.set(userId, { name: userName, ws });
      console.log(`User ${userName} (ID: ${userId}) connected.`);
      ws.send(JSON.stringify({ type: 'connect-done', id: userId, name: userName }));
      const summaries = buildConversationSummaries(userId);
      if (summaries.length) ws.send(JSON.stringify({ type: 'conversation-summaries', conversations: summaries }));
      return;
    }

    if (data.type === 'lookup-user') {
      const qid = parseInt(data.id);
      if (users.has(qid)) {
        const u = users.get(qid);
        ws.send(JSON.stringify({ type: 'user-info', exists: true, id: qid, name: u.name }));
      } else {
        ws.send(JSON.stringify({ type: 'user-info', exists: false, id: qid }));
      }
      return;
    }

    if (data.type === 'get-messages') {
      const convKey = getConversationKey(userId, data.withId);
      const list = messages.get(convKey) || [];
      // Mark any messages destined to this user as delivered if not yet
      list.forEach(m => {
        if (m.destination === userId && !m.delivered) {
          m.delivered = true;
          // notify original sender if online
          if (users.has(m.source.id)) {
            const s = users.get(m.source.id);
            if (s.ws.readyState === WebSocket.OPEN) s.ws.send(JSON.stringify({ type:'message-status', messageId: m.messageId, status:'delivered', with: userId }));
          }
        }
      });
      console.log(`Sending ${list.length} messages to user ${userName} (ID: ${userId}) for conversation with ${data.withId}.`);
      ws.send(JSON.stringify({ type: 'messages', messages: list }));
      return;
    }

  if (data.type === 'message') {
      const destId = data.destination;
      const text = data.text;
      const source = { id: userId, name: userName };
      const payload = {
        type: 'message',
        text,
        source,
        destination: destId,
        time: new Date().toISOString(),
        messageId: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        delivered: false,
        read: false
      };
      // Store message
      const convKey = getConversationKey(userId, destId);
      if (!messages.has(convKey)) messages.set(convKey, []);
      messages.get(convKey).push(payload);
      console.log(`Message from ${userName} (ID: ${userId}) to ${destId}: "${text}"`);

      // Send to destination user if exists
      if (users.has(destId)) {
        const destUser = users.get(destId);
        if (destUser.ws.readyState === WebSocket.OPEN) {
          destUser.ws.send(JSON.stringify(payload));
          payload.delivered = true;
          // inform sender of delivered
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type:'message-status', messageId: payload.messageId, status:'delivered', with: destId }));
          console.log(`Delivered message to ${destUser.name} (ID: ${destId}).`);
        }
      } else {
        console.log(`User ${destId} not online, message stored.`);
      }
      // Echo back to sender so client can rely solely on server events
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
      }
  return;
    }
    if (data.type === 'typing' || data.type === 'typing-stop') {
      const otherId = parseInt(data.with);
      if (!otherId || otherId === userId) return;
      if (users.has(otherId)) {
        const other = users.get(otherId);
        if (other.ws.readyState === WebSocket.OPEN) {
          other.ws.send(JSON.stringify({ type: data.type, from: userId }));
        }
      }
      return;
    }
    if (data.type === 'mark-read') {
      const otherId = parseInt(data.with);
      if (!otherId) return;
      const convKey = getConversationKey(userId, otherId);
      const list = messages.get(convKey) || [];
      list.forEach(m => {
        if (m.destination === userId) {
          if (!m.delivered) {
            m.delivered = true;
            if (users.has(m.source.id)) {
              const s = users.get(m.source.id);
              if (s.ws.readyState === WebSocket.OPEN) s.ws.send(JSON.stringify({ type:'message-status', messageId: m.messageId, status:'delivered', with: userId }));
            }
          }
          if (!m.read) {
            m.read = true;
            if (users.has(m.source.id)) {
              const s = users.get(m.source.id);
              if (s.ws.readyState === WebSocket.OPEN) s.ws.send(JSON.stringify({ type:'message-status', messageId: m.messageId, status:'read', with: userId }));
            }
          }
        }
      });
      return;
    }

    if (data.type === 'delete-message') {
      // data: { type:'delete-message', messageId, with: otherUserId, scope:'all'|'me' }
      const { messageId, with: otherId, scope } = data;
      if (!messageId || !otherId) return;
      const convKey = getConversationKey(userId, otherId);
      const list = messages.get(convKey) || [];
      if (scope === 'all') {
        const idx = list.findIndex(m => m.messageId === messageId);
        if (idx === -1) return;
        const msg = list[idx];
        // Only original sender can delete for all
        if (msg.source.id !== userId) {
          ws.send(JSON.stringify({ type: 'delete-error', messageId, reason: 'Not allowed' }));
          return;
        }
        // Remove message from list for privacy
        list.splice(idx, 1);
        if (!list.length) {
          // If conversation is now empty remove it
          messages.delete(convKey);
        }
        console.log(`Message ${messageId} removed for all in conversation ${convKey} by user ${userId}.`);
        const payload = { type: 'message-removed', messageId, with: otherId };
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
        if (users.has(otherId)) {
          const other = users.get(otherId);
          if (other.ws.readyState === WebSocket.OPEN) other.ws.send(JSON.stringify(payload));
        }
      } else if (scope === 'me') {
        // Client will handle local removal; optionally acknowledge
        ws.send(JSON.stringify({ type: 'message-deleted-local', messageId }));
      }
      return;
    }

    if (data.type === 'edit-message') {
      // { type:'edit-message', messageId, with: otherId, newText }
      const { messageId, with: otherId, newText } = data;
      if (!messageId || !otherId || typeof newText !== 'string' || !newText.trim()) return;
      const convKey = getConversationKey(userId, otherId);
      const list = messages.get(convKey) || [];
      const msg = list.find(m => m.messageId === messageId);
      if (!msg) return;
      if (msg.source.id !== userId || msg.deletedAll) {
        ws.send(JSON.stringify({ type:'edit-error', messageId, reason:'Not allowed' }));
        return;
      }
      msg.text = newText.trim();
      msg.edited = true;
      msg.timeEdited = new Date().toISOString();
      const payload = { type:'message-edited', messageId, newText: msg.text, with: otherId, timeEdited: msg.timeEdited };
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
      if (users.has(otherId)) {
        const other = users.get(otherId);
        if (other.ws.readyState === WebSocket.OPEN) other.ws.send(JSON.stringify(payload));
      }
      return;
    }

    if (data.type === 'delete-chat') {
      // { type:'delete-chat', with: otherId, scope:'all'|'me' }
      const { with: otherId, scope } = data;
      if (!otherId) return;
      const convKey = getConversationKey(userId, otherId);
      if (scope === 'all') {
        if (messages.has(convKey)) {
          messages.delete(convKey);
          console.log(`Conversation ${convKey} fully removed for all by user ${userId}`);
        }
        const payload = { type:'chat-deleted', with: otherId };
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
        if (users.has(otherId)) {
          const other = users.get(otherId);
          if (other.ws.readyState === WebSocket.OPEN) other.ws.send(JSON.stringify(payload));
        }
      } else if (scope === 'me') {
        // Only acknowledge to requester; client handles local removal
        ws.send(JSON.stringify({ type:'chat-deleted-local', with: otherId }));
      }
      return;
    }
  });

  ws.on('close', () => {
    if (userId !== null) {
      const existing = users.get(userId);
      // Only delete if the stored ws is this socket (not replaced)
      if (existing && existing.ws === ws) {
        users.delete(userId);
      }
    }
  });
});

console.log(`WebSocket server is running on ws://localhost:${PORT}`);
