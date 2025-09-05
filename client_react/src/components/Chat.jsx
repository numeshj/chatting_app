import { useEffect, useRef, useState } from "react";

function Chat({ connectedUser, messages, onSendMessage, notification, onClearNotification, onBack }) {
  const [userMessage, setUserMessage] = useState("");
  const listRef = useRef(null);

  const sendMessage = () => {
    if (!userMessage.trim()) return;
    onSendMessage(userMessage.trim());
    setUserMessage("");
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="whatsapp-container">
      <div className="chat-header">
        <button onClick={onBack} style={{marginRight:12, background:'transparent', border:'none', color:'#fff', cursor:'pointer', fontSize:18}} aria-label="Back to chats">←</button>
        <div className="contact-info">
          <div className="contact-name">{connectedUser.name} ({connectedUser.id})</div>
          <div className="contact-status">Online</div>
        </div>
        {notification && (
          <div className="notification-icon" onClick={onClearNotification} title="New messages">
            🔔
          </div>
        )}
      </div>
      <div className="chat-messages" ref={listRef}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: 40, opacity: 0.6, fontSize: 14 }}>
            No messages yet. Start the conversation.
          </div>
        )}
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.type}`}>
            <div className="message-bubble" style={{fontWeight: msg.unread? 600: 400}}>
              <div className="message-text">{msg.text}</div>
              <div className="message-time">{new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="chat-input-container">
        <div className="input-wrapper">
          <input
            type="text"
            placeholder="Type a message..."
            value={userMessage}
            onChange={e => setUserMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            className="message-input"
            aria-label="Message input"
          />
          <button
            className="send-button"
            onClick={sendMessage}
            disabled={!userMessage.trim()}
            aria-label="Send message"
          >
            <svg viewBox="0 0 24 24" width="24" height="24" role="img" aria-hidden="true">
              <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default Chat;
