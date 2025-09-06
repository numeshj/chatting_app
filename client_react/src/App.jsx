
import { useEffect, useRef, useState } from "react";
import './App.css';
import Login from './components/Login';
import Connect from './components/Connect';
import Chat from './components/Chat';

function App() {
  const socket = useRef(null);
  const [user, setUser] = useState(null);
  const [connectedUser, setConnectedUser] = useState(null);
  const [messages, setMessages] = useState([]); // current open conversation
  const [notification, setNotification] = useState(false);
  const [incomingMessage, setIncomingMessage] = useState(null);
  const [chats, setChats] = useState([]); // list of { with:{id,name}, lastMessage }
  const userRef = useRef(null);
  const connectedUserRef = useRef(null);

  // Keep refs in sync for use inside socket listener
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { connectedUserRef.current = connectedUser; }, [connectedUser]);

  const onConnect = (name, id, setError) => {
    try {
      socket.current.send(JSON.stringify({ type: "connect", name, id }));
      localStorage.setItem('lastUser', JSON.stringify({ name, id }));
    } catch (e) {
      setError?.('Connection not ready');
    }
  };

  const connectToUser = (name, id) => {
    setConnectedUser({ name, id });
    // Load messages from localStorage
    const convKey = getConversationKey(user.id, id);
    const stored = localStorage.getItem(convKey);
    if (stored) {
      setMessages(JSON.parse(stored));
    } else {
      setMessages([]);
    }
    // Request messages from server
    socket.current.send(JSON.stringify({ type: "get-messages", withId: id }));
  };

  const sendMessage = (text) => {
    if (!connectedUser) return;
    const payload = {
      type: "message",
      text,
      destination: connectedUser.id
    };
    // Do NOT optimistically add; rely on server echo so both sides share canonical timestamps
    socket.current.send(JSON.stringify(payload));
  };

  const getConversationKey = (id1, id2) => {
    return [id1, id2].sort().join('-');
  };

  const deleteMessageLocal = (msg) => {
    // Remove only locally (for me)
    setMessages(prev => prev.filter(m => m.messageId !== msg.messageId));
    // Persist updated conversation
    if (connectedUser) {
      const convKey = getConversationKey(user.id, connectedUser.id);
      setTimeout(()=>{
        const newMsgs = messages.filter(m => m.messageId !== msg.messageId);
        localStorage.setItem(convKey, JSON.stringify(newMsgs));
      },0);
    }
  };

  const deleteMessageAll = (msg) => {
    if (!connectedUser) return;
    socket.current.send(JSON.stringify({ type:'delete-message', messageId: msg.messageId, with: connectedUser.id, scope:'all' }));
  };

  const editMessage = (msg, newText) => {
    if (!connectedUser) return;
    socket.current.send(JSON.stringify({ type:'edit-message', messageId: msg.messageId, with: connectedUser.id, newText }));
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
    socket.current.send(JSON.stringify({ type:'delete-chat', with: connectedUser.id, scope:'all' }));
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

  useEffect(() => {
    if (socket.current) return;
    socket.current = new WebSocket("ws://localhost:3001");
    socket.current.addEventListener('open', () => {
      // auto login if saved
      const saved = localStorage.getItem('lastUser');
      if (saved) {
        try { const parsed = JSON.parse(saved); onConnect(parsed.name, parsed.id); } catch(_){}
      }
    });
    socket.current.addEventListener("message", event => {
      try {
        const data = JSON.parse(event.data);
        const currentUser = userRef.current;
        const currentChat = connectedUserRef.current;
        if (data.type === "connect-done") {
          setUser({ name: data.name, id: data.id });
          return;
        }
        if (data.type === "connect-error") {
          alert(data.message);
          return;
        }
        if (data.type === "conversation-summaries") {
          // Initialize unread state from localStorage
          setChats(data.conversations.map(c => ({ ...c, unread: 0 })));
          return;
        }
        if (data.type === "messages") {
          setMessages(data.messages.map(msg => ({
            ...msg,
            type: msg.source.id === currentUser?.id ? 'sent' : 'received'
          })));
          return;
        }
        if (data.type === "message") {
          const isOwn = data.source.id === currentUser?.id;
          const classified = { ...data, type: isOwn ? 'sent' : 'received' };
          // Update chat summaries
          setChats(prev => {
            const otherId = isOwn ? classified.destination : classified.source.id;
            const otherName = isOwn ? (prev.find(c=>c.with.id===otherId)?.with.name || `User${otherId}`) : classified.source.name;
            let found = prev.find(c=>c.with.id===otherId);
            const unreadIncrement = (!isOwn && (!currentChat || currentChat.id !== otherId)) ? 1 : 0;
            const updated = { with:{ id: otherId, name: otherName }, lastMessage: classified, unread: (found?.unread||0)+unreadIncrement };
            const remaining = prev.filter(c=>c.with.id!==otherId);
            return [updated, ...remaining].sort((a,b)=> new Date(b.lastMessage.time) - new Date(a.lastMessage.time));
          });
          // Notification only if NOT own message AND either no chat open or different chat
          if (!isOwn && (!currentChat || currentChat.id !== classified.source.id)) {
            setIncomingMessage({ name: data.source.name, text: data.text });
            setNotification(true);
          }
          // Append if message pertains to open chat
          if (currentChat && (classified.source.id === currentChat.id || classified.destination === currentChat.id)) {
            setMessages(prev => [...prev, classified]);
          }
          return;
        }
        if (data.type === 'message-deleted') {
          // Mark message as deletedAll if exists
          setMessages(prev => prev.map(m => m.messageId === data.messageId ? { ...m, deletedAll: true, text:'' } : m));
          return;
        }
        if (data.type === 'message-edited') {
          setMessages(prev => prev.map(m => m.messageId === data.messageId ? { ...m, text: data.newText, edited: true } : m));
          return;
        }
        if (data.type === 'chat-deleted') {
          // The chat was wiped for all -> mark messages as deleted
          setMessages(prev => prev.map(m => ({ ...m, deletedAll: true, text:'' })));
          return;
        }
        if (data.type === 'message-deleted-local') {
          // no-op: we already removed locally
          return;
        }
      } catch (e) {
        console.error('Error parsing message:', e, event.data);
      }
    });
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
        <button onClick={logout} style={{padding:'6px 12px', cursor:'pointer', borderRadius:6, border:'1px solid #ccc', background:'#fff'}}>Logout</button>
      </div>
      <Connect user={user} onConnectToUser={connectToUser} chats={chats} onOpenChat={(c)=>{ connectToUser(c.with.name, c.with.id); setChats(prev=> prev.map(ch=> ch.with.id===c.with.id? {...ch, unread:0}: ch)); }} />
    </>;
  }

  return (
    <>
      {incomingMessage && (
        <div className="message-notification">
          <p>New message from {incomingMessage.name}: {incomingMessage.text}</p>
          <button onClick={handleReadMessage}>Read</button>
        </div>
      )}
  <Chat
        connectedUser={connectedUser}
        messages={messages}
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
