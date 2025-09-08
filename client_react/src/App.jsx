
import { useEffect, useRef, useState } from "react";
import './App.css';
import Login from './components/Login';
import Connect from './components/Connect';
import Chat from './components/Chat';
import NotificationToast from './components/NotificationToast';

function App() {
  const socket = useRef(null);
  const [user, setUser] = useState(null);
  const [connectedUser, setConnectedUser] = useState(null);
  const [messages, setMessages] = useState([]); // current open conversation
  const [notification, setNotification] = useState(false);
  const [incomingMessage, setIncomingMessage] = useState(null);
  const [chats, setChats] = useState([]); // list of { with:{id,name}, lastMessage }
  const [typingFrom, setTypingFrom] = useState(null); // userId currently typing to me in open chat
  const typingTimeoutRef = useRef(null);
  const userRef = useRef(null);
  const connectedUserRef = useRef(null);
  const lastSyncRef = useRef({}); // convKey -> ISO time of newest message we have
  const connectErrorSetterRef = useRef(null);
  const pendingLookupsRef = useRef({}); // id -> resolve

  // Keep refs in sync for use inside socket listener
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { connectedUserRef.current = connectedUser; }, [connectedUser]);

  // Ensure socket is open (re-create if closed) then invoke callback
  const ensureSocket = (cb) => {
    if (socket.current && socket.current.readyState === WebSocket.OPEN) { cb(); return; }
    if (!socket.current || socket.current.readyState === WebSocket.CLOSING || socket.current.readyState === WebSocket.CLOSED) {
      try { socket.current?.close(); } catch(_){ }
      let WS_BASE = import.meta.env.VITE_WS_URL;
      if (!WS_BASE) {
        const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
        if (isLocal) {
          WS_BASE = 'ws://localhost:3001';
        } else {
          console.warn('WebSocket not initialized: set VITE_WS_URL env (e.g. wss://your-backend.example.com)');
          return; // abort ensureSocket; caller callback never runs until configured
        }
      }
      socket.current = new WebSocket(WS_BASE);
      window.__appSocket = socket.current;
    }
    const handler = () => {
      socket.current?.removeEventListener('open', handler);
      cb();
    };
    socket.current.addEventListener('open', handler);
  };

  // Login to server (NOT opening a chat)
  const onConnect = (name, id, setError) => {
    connectErrorSetterRef.current = setError || null;
    ensureSocket(() => {
      try {
        socket.current.send(JSON.stringify({ type: 'connect', name, id }));
        localStorage.setItem('lastUser', JSON.stringify({ name, id }));
      } catch(e) {
        setError?.('Failed to send connect');
      }
    });
  };

  const lookupUser = (id) => new Promise((resolve) => {
    ensureSocket(()=> {
      pendingLookupsRef.current[id] = resolve;
      try { socket.current.send(JSON.stringify({ type:'lookup-user', id })); } catch { resolve({ exists:false, id }); }
    });
  });

  // Open / focus a conversation with another user
  const connectToUser = (name, id) => {
    if (!user) return;
    setConnectedUser({ name, id });
    // Clear notification if from this user
    setIncomingMessage(prev => prev && prev.sourceId === id ? null : prev);
    const convKey = getConversationKey(user.id, id);
    const stored = localStorage.getItem(convKey);
    if (stored) {
      try { setMessages(JSON.parse(stored)); } catch { setMessages([]); }
    } else {
      setMessages([]);
    }
    ensureSocket(() => {
      try { socket.current.send(JSON.stringify({ type: 'get-messages', withId: id })); } catch {}
  try { socket.current.send(JSON.stringify({ type:'mark-read', with:id })); } catch {}
    });
  };

  const getConversationKey = (id1, id2) => [id1, id2].sort().join('-');
  const getHiddenKey = (convKey) => convKey + ':hidden';
  const readHiddenIds = (convKey) => {
    try { const raw = localStorage.getItem(getHiddenKey(convKey)); return raw? JSON.parse(raw): []; } catch { return []; }
  };
  const addHiddenId = (convKey, messageId) => {
    try {
      const list = readHiddenIds(convKey);
      if (!list.includes(messageId)) localStorage.setItem(getHiddenKey(convKey), JSON.stringify([...list, messageId]));
    } catch {}
  };

  const sendMessage = (text) => {
    if (!connectedUser) return;
    const payload = {
      type: "message",
      text,
      destination: connectedUser.id
    };
    // Do NOT optimistically add; rely on server echo so both sides share canonical timestamps
    ensureSocket(() => {
      try { socket.current.send(JSON.stringify(payload)); } catch {}
    });
  };

  const deleteMessageLocal = (msg) => {
    setMessages(prev => {
      const updated = prev.filter(m => m.messageId !== msg.messageId);
      setChats(prevChats => prevChats.map(c => {
        if (!connectedUser || c.with.id !== connectedUser.id) return c;
        if (!c.lastMessage || c.lastMessage.messageId !== msg.messageId) return c;
        const newLast = updated[updated.length - 1] || null;
        return { ...c, lastMessage: newLast };
      }));
      return updated;
    });
    if (connectedUser) {
      const convKey = getConversationKey(user.id, connectedUser.id);
      try {
        const stored = localStorage.getItem(convKey);
        if (stored) {
          const parsed = JSON.parse(stored).filter(m => m.messageId !== msg.messageId);
          localStorage.setItem(convKey, JSON.stringify(parsed));
        }
      } catch { /* ignore */ }
      addHiddenId(convKey, msg.messageId);
    }
  };

  const deleteMessageAll = (msg) => {
    if (!connectedUser) return;
    ensureSocket(()=>{
      try { socket.current.send(JSON.stringify({ type:'delete-message', messageId: msg.messageId, with: connectedUser.id, scope:'all' })); } catch {}
    });
  };

  const editMessage = (msg, newText) => {
    if (!connectedUser) return;
    ensureSocket(()=>{
      try { socket.current.send(JSON.stringify({ type:'edit-message', messageId: msg.messageId, with: connectedUser.id, newText })); } catch {}
    });
  };

  const deleteChatLocal = () => {
    if (!connectedUser) return;
    const convKey = getConversationKey(user.id, connectedUser.id);
    // Remove from local state and storage
    setMessages([]);
    localStorage.removeItem(convKey);
    setConnectedUser(null);
    setChats(prev => prev.filter(c => c.with.id !== connectedUser.id));
  };

  const deleteChatAll = () => {
    if (!connectedUser) return;
    ensureSocket(()=>{
      try { socket.current.send(JSON.stringify({ type:'delete-chat', with: connectedUser.id, scope:'all' })); } catch {}
    });
  };

  const logout = () => {
    setConnectedUser(null);
    setMessages([]);
    setChats([]);
    setUser(null);
    try { localStorage.removeItem('lastUser'); } catch(_){}
    try { socket.current?.close(); } catch(_){}
    socket.current = null;
  };

  // Hydrate cached chats early (optimistic) before websocket summaries
  useEffect(() => {
    try {
      const cached = localStorage.getItem('cachedChats');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) setChats(parsed);
      }
    } catch {}
  }, []);

  // Persist chats whenever they change (exclude unread ephemeral changes? we store them anyway)
  useEffect(() => {
    try { localStorage.setItem('cachedChats', JSON.stringify(chats)); } catch {}
  }, [chats]);

  // Initial socket creation + auto-login if saved
  useEffect(() => {
    if (!socket.current) {
      let WS_BASE = import.meta.env.VITE_WS_URL;
      if (!WS_BASE) {
        const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
        if (isLocal) {
          WS_BASE = 'ws://localhost:3001';
        } else {
          console.warn('WebSocket disabled: define VITE_WS_URL env variable pointing to deployed server.');
          return;
        }
      }
      socket.current = new WebSocket(WS_BASE);
      // expose for child components needing quick access (typing). In production, pass via context/props.
      window.__appSocket = socket.current;
      socket.current.addEventListener('open', () => {
        const saved = localStorage.getItem('lastUser');
        if (saved && !userRef.current) {
          try { const parsed = JSON.parse(saved); onConnect(parsed.name, parsed.id); } catch {}
        }
      });
      const messageHandler = (event) => {
        let data;
        try { data = JSON.parse(event.data); } catch { return; }
        const currentUser = userRef.current;
        const currentChat = connectedUserRef.current;
  // Allow summaries to be processed even if userRef not yet synced after setUser
  if (!currentUser && !['connect-done','connect-error','conversation-summaries'].includes(data.type)) return;
        switch (data.type) {
          case 'connect-done':
            setUser({ name: data.name, id: data.id });
            return;
          case 'connect-error':
            console.error('Connect error:', data.message);
            try { localStorage.removeItem('lastUser'); } catch(_){ }
            connectErrorSetterRef.current?.(data.message || 'Connect failed');
            return;
          case 'user-info': {
            const resolver = pendingLookupsRef.current[data.id];
            if (resolver) {
              resolver(data);
              delete pendingLookupsRef.current[data.id];
            }
            return;
          }
          case 'conversation-summaries':
            setChats(data.conversations.map(c => ({ ...c, unread: 0 })));
            return;
          case 'messages': {
            const convOtherId = data.messages.length ? (data.messages[0].source.id === currentUser?.id ? data.messages[0].destination : data.messages[0].source.id) : null;
            const convKey = convOtherId ? getConversationKey(currentUser.id, convOtherId) : null;
            const hidden = convKey ? readHiddenIds(convKey) : [];
            const filtered = data.messages.filter(m => !hidden.includes(m.messageId)).map(msg => ({ ...msg, type: msg.source.id === currentUser?.id ? 'sent':'received' }));
            setMessages(filtered);
            if (convKey && filtered.length) {
              const newest = filtered[filtered.length -1].time;
              lastSyncRef.current[convKey] = newest;
            }
            return;
          }
          case 'message': {
            const isOwn = data.source.id === currentUser?.id;
            const classified = { ...data, type: isOwn ? 'sent' : 'received' };
            const convKey = getConversationKey(currentUser.id, isOwn ? classified.destination : classified.source.id);
            const hidden = readHiddenIds(convKey);
            if (hidden.includes(classified.messageId)) return;
            if (!isOwn && (!currentChat || currentChat.id !== classified.source.id)) {
              setIncomingMessage({ name: data.source.name, text: data.text, sourceId: data.source.id, messageId: data.messageId });
              setNotification(true);
            }
            // If it's a received message and the chat is currently open with this user, immediately mark-read
            if (!isOwn && currentChat && currentChat.id === classified.source.id) {
              try { socket.current?.send(JSON.stringify({ type:'mark-read', with: classified.source.id })); } catch {}
              classified.delivered = true; // optimistic
              classified.read = true;      // optimistic instant read
            }
            setChats(prev => {
              const otherId = isOwn ? classified.destination : classified.source.id;
              const otherName = isOwn ? (prev.find(c=>c.with.id===otherId)?.with.name || `User${otherId}`) : classified.source.name;
              const found = prev.find(c=>c.with.id===otherId);
              const unreadIncrement = (!isOwn && (!currentChat || currentChat.id !== otherId)) ? 1 : 0;
              const updated = { with:{ id: otherId, name: otherName }, lastMessage: classified, unread: (found?.unread||0)+unreadIncrement };
              const remaining = prev.filter(c=>c.with.id!==otherId);
              return [updated, ...remaining].sort((a,b)=> new Date(b.lastMessage.time) - new Date(a.lastMessage.time));
            });
            if (currentChat && (classified.source.id === currentChat.id || classified.destination === currentChat.id)) {
              setMessages(prev => [...prev, classified]);
            }
            // update last sync
            lastSyncRef.current[convKey] = classified.time;
            return;
          }
          case 'typing': {
            if (currentChat && data.from === currentChat.id) {
              setTypingFrom(data.from);
              if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
              typingTimeoutRef.current = setTimeout(()=> setTypingFrom(null), 4000);
            }
            return;
          }
          case 'typing-stop': {
            if (currentChat && data.from === currentChat.id) {
              setTypingFrom(null);
              if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current=null; }
            }
            return;
          }
          case 'message-status': {
            // update single message status (delivered/read)
            setMessages(prev => prev.map(m => m.messageId === data.messageId ? { ...m, [data.status]: true } : m));
            setChats(prev => prev.map(c => {
              if (c.lastMessage?.messageId === data.messageId) {
                return { ...c, lastMessage: { ...c.lastMessage, [data.status]: true } };
              }
              return c;
            }));
            return;
          }
          case 'message-removed': {
            setMessages(prev => {
              const updated = prev.filter(m => m.messageId !== data.messageId);
              if (currentChat) {
                setChats(prevChats => prevChats.map(c => {
                  if (c.with.id !== currentChat.id) return c;
                  if (c.lastMessage?.messageId === data.messageId) {
                    const newLast = updated[updated.length - 1] || null;
                    return { ...c, lastMessage: newLast };
                  }
                  return c;
                }));
              }
              return updated;
            });
            if (currentChat) {
              const convKey = getConversationKey(currentUser.id, currentChat.id);
              const hidden = readHiddenIds(convKey).filter(id => id !== data.messageId);
              localStorage.setItem(getHiddenKey(convKey), JSON.stringify(hidden));
            }
            return;
          }
          case 'message-edited':
            setMessages(prev => prev.map(m => m.messageId === data.messageId ? { ...m, text: data.newText, edited: true } : m));
            return;
          case 'chat-deleted':
            if (currentChat && currentChat.id === data.with) {
              setMessages([]);
              setConnectedUser(null);
            }
            setChats(prev => prev.filter(c => c.with.id !== data.with));
            return;
          case 'message-deleted-local':
            return; // ignore
          default:
            return;
        }
      };
      socket.current.addEventListener('message', messageHandler);
    }
  }, []);

  useEffect(() => {
    if (connectedUser && messages.length > 0) {
      const convKey = getConversationKey(user.id, connectedUser.id);
      localStorage.setItem(convKey, JSON.stringify(messages));
    }
  }, [messages, connectedUser, user]);

  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const handleReadMessage = () => {
    setIncomingMessage(null);
  };

  if (!user) {
    return <Login onConnect={onConnect} />;
  }

  if (!connectedUser) {
    return <>
      <div style={{position:'absolute', top:10, right:10}}>
        <button onClick={logout} className="wa-logout-btn">Logout</button>
      </div>
  <Connect user={user} lookupUser={lookupUser} onConnectToUser={connectToUser} chats={chats} onOpenChat={(c)=>{ connectToUser(c.with.name, c.with.id); setChats(prev=> prev.map(ch=> ch.with.id===c.with.id? {...ch, unread:0}: ch)); }} />
    </>;
  }

  return (
    <>
      {incomingMessage && (!connectedUser || connectedUser.id !== incomingMessage.sourceId) && (
        <NotificationToast
          message={incomingMessage}
          onClick={() => handleReadMessage()}
          onClose={() => setIncomingMessage(null)}
        />
      )}
      <Chat
        connectedUser={connectedUser}
        messages={messages}
  typing={typingFrom === connectedUser.id}
        onSendMessage={sendMessage}
        notification={notification}
        onClearNotification={() => setNotification(false)}
        onDeleteLocal={deleteMessageLocal}
        onDeleteAll={deleteMessageAll}
        onEditMessage={editMessage}
        onDeleteChatLocal={deleteChatLocal}
        onDeleteChatAll={deleteChatAll}
        onBack={() => { setConnectedUser(null); setMessages([]); setChats(prev=> prev.map(ch=> ch.with.id===connectedUser.id? {...ch, unread:0}: ch)); }}
      />
    </>
  );
}

export default App;
