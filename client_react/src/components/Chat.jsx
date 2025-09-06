import { useEffect, useRef, useState } from "react";

function Chat({ connectedUser, messages, onSendMessage, notification, onClearNotification, onBack, onDeleteLocal, onDeleteAll, onEditMessage, onDeleteChatLocal, onDeleteChatAll }) {
  const [userMessage, setUserMessage] = useState("");
  const listRef = useRef(null);
  const [contextMessage, setContextMessage] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editValue, setEditValue] = useState('');

  const openContext = (msg, e) => {
    e.preventDefault();
    setContextMessage(msg);
  };

  const closeContext = () => setContextMessage(null);

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
            <div style={{position:'relative', maxWidth:'70%'}}>
              <div className="message-bubble" onContextMenu={(e)=>openContext(msg,e)} style={{fontWeight: msg.unread? 600: 400, opacity: msg.deletedAll? .6:1, fontStyle: msg.deletedAll? 'italic':'normal'}}>
                <div className="message-text">{msg.deletedAll ? 'Message deleted' : msg.text}{msg.edited && !msg.deletedAll && <span style={{marginLeft:6, fontSize:10, opacity:.6}}>(edited)</span>}</div>
                <div className="message-time">{new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              {!msg.deletedAll && (
                <button aria-label="Message actions" onClick={(e)=>{openContext(msg,e);}} style={{position:'absolute', top:4, right:4, background:'transparent', border:'none', cursor:'pointer', color:'#555', fontSize:14, padding:2}}>&#8942;</button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div style={{padding:'4px 12px', display:'flex', justifyContent:'flex-end', gap:8}}>
        <button onClick={()=> onDeleteChatLocal()} style={{background:'#eee', border:'1px solid #ccc', padding:'6px 10px', borderRadius:6, cursor:'pointer'}}>Delete Chat (Me)</button>
        <button onClick={()=> onDeleteChatAll()} style={{background:'#ffe6e6', border:'1px solid #ffb3b3', padding:'6px 10px', borderRadius:6, cursor:'pointer', color:'#b50000'}}>Delete Chat (All)</button>
      </div>
      {contextMessage && (
        <div style={{position:'fixed', inset:0}} onClick={closeContext}>
          <div style={{position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)', background:'#fff', padding:16, borderRadius:8, boxShadow:'0 4px 18px rgba(0,0,0,0.2)', minWidth:220, display:'flex', flexDirection:'column', gap:8}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:14, fontWeight:600}}>Message options</div>
            <button style={{padding:'8px 10px', cursor:'pointer'}} onClick={()=>{ onDeleteLocal(contextMessage); closeContext(); }}>Delete for me</button>
            {contextMessage.type === 'sent' && !contextMessage.deletedAll && (
              <button style={{padding:'8px 10px', cursor:'pointer', color:'#d93025'}} onClick={()=>{ onDeleteAll(contextMessage); closeContext(); }}>Delete for all</button>
            )}
            {contextMessage.type === 'sent' && !contextMessage.deletedAll && (
              <button style={{padding:'8px 10px', cursor:'pointer'}} onClick={()=>{ setEditingMessage(contextMessage); setEditValue(contextMessage.text); closeContext(); }}>Edit</button>
            )}
            <button style={{padding:'6px 10px', cursor:'pointer'}} onClick={closeContext}>Cancel</button>
          </div>
        </div>
      )}
      {editingMessage && (
        <div style={{position:'fixed', inset:0}} onClick={()=> setEditingMessage(null)}>
          <div style={{position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)', background:'#fff', padding:20, borderRadius:10, boxShadow:'0 6px 22px rgba(0,0,0,0.25)', width:'min(400px,90vw)', display:'flex', flexDirection:'column', gap:12}} onClick={e=>e.stopPropagation()}>
            <h4 style={{margin:0}}>Edit message</h4>
            <textarea value={editValue} onChange={e=> setEditValue(e.target.value)} style={{width:'100%', minHeight:90, resize:'vertical', padding:8}} />
            <div style={{display:'flex', justifyContent:'flex-end', gap:8}}>
              <button onClick={()=> setEditingMessage(null)} style={{padding:'8px 14px', cursor:'pointer'}}>Cancel</button>
              <button disabled={!editValue.trim()} onClick={()=> { onEditMessage(editingMessage, editValue.trim()); setEditingMessage(null); }} style={{padding:'8px 14px', cursor:'pointer', background:'#075e54', color:'#fff', border:'none', borderRadius:6}}>Save</button>
            </div>
          </div>
        </div>
      )}
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
