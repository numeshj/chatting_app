
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
    socket.current.send(JSON.stringify({ type: "connect", name, id }));
    // Handle error in useEffect
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

  useEffect(() => {
    if (socket.current) return;
    socket.current = new WebSocket("ws://localhost:3001");
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
          setChats(data.conversations);
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
            const existing = prev.filter(c => c.with.id !== otherId);
            return [{ with: { id: otherId, name: otherName }, lastMessage: classified }, ...existing];
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
    return <Connect user={user} onConnectToUser={connectToUser} chats={chats} onOpenChat={(c)=>connectToUser(c.with.name, c.with.id)} />;
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
  onBack={() => { setConnectedUser(null); setMessages([]); }}
      />
    </>
  );
}

export default App;
