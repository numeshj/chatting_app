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
        const existing = users.get(requestedId);
        // Allow reconnect if name matches; replace old socket
        if (existing.name === requestedName) {
          try { existing.ws.close(4000, 'Replaced by new connection'); } catch (_) {}
          users.set(requestedId, { name: existing.name, ws });
          userId = requestedId;
          userName = existing.name;
          console.log(`User ${userName} (ID: ${userId}) reconnected (previous session replaced).`);
          ws.send(JSON.stringify({ type: 'connect-done', id: userId, name: userName, reconnected: true }));
          const summaries = buildConversationSummaries(userId);
          if (summaries.length) ws.send(JSON.stringify({ type: 'conversation-summaries', conversations: summaries }));
        } else {
          console.log(`User ${requestedName} tried to connect with ID ${requestedId}, but ID already exists with different name.`);
          ws.send(JSON.stringify({ type: 'connect-error', message: 'ID already in use by different name.' }));
        }
        return;
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

    if (data.type === 'get-messages') {
      const convKey = getConversationKey(userId, data.withId);
      const msgs = messages.get(convKey) || [];
      console.log(`Sending ${msgs.length} messages to user ${userName} (ID: ${userId}) for conversation with ${data.withId}.`);
      ws.send(JSON.stringify({ type: 'messages', messages: msgs }));
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
    messageId: Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
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
        if (!msg.deletedAll) {
          msg.deletedAll = true;
          msg.text = '';
          console.log(`Message ${messageId} deleted for all in conversation ${convKey} by user ${userId}.`);
        }
        // Notify both participants
        const payload = { type: 'message-deleted', messageId, with: otherId };
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
  });

  ws.on('close', () => {
    if (userId !== null) {
      users.delete(userId);
    }
  });
});

console.log(`WebSocket server is running on ws://localhost:${PORT}`);
