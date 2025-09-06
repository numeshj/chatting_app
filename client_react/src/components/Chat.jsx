import { useEffect, useRef, useState } from "react";

function Chat({ connectedUser, messages, onSendMessage, notification, onClearNotification, onBack, onDeleteLocal, onDeleteAll, onEditMessage, onDeleteChatLocal, onDeleteChatAll }) {
  const [userMessage, setUserMessage] = useState("");
  const listRef = useRef(null);
  const [contextMessage, setContextMessage] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const inputRef = useRef(null);
  const [contextPos, setContextPos] = useState(null); // {x,y}

  const openContext = (msg, e) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setContextPos({ x: rect.right - 10, y: rect.bottom + 4 });
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

  useEffect(()=>{ inputRef.current?.focus(); }, []);

  return (
  <div className="wa-app-container">
  <div className="wa-chat-header-base wa-chat-header">
        <button onClick={onBack} style={{marginRight:12, background:'transparent', border:'none', color:'#fff', cursor:'pointer', fontSize:18}} aria-label="Back to chats">←</button>
        <div className="contact-info wa-contact-info">
          <div className="contact-name wa-contact-name">{connectedUser.name} ({connectedUser.id})</div>
          <div className="contact-status wa-contact-status">Online</div>
        </div>
        <button aria-label="Chat actions" className="wa-chat-actions-btn" onClick={()=> setChatMenuOpen(o=>!o)}>
          &#9662;
        </button>
        {notification && (
          <div className="notification-icon wa-notification-icon" onClick={onClearNotification} title="New messages">
            🔔
          </div>
        )}
        {chatMenuOpen && (
          <div className="wa-chat-menu-pop" onClick={()=> setChatMenuOpen(false)}>
            <div className="wa-chat-menu" onClick={e=> e.stopPropagation()}>
              <button className="wa-chat-menu-item" onClick={()=> { onDeleteChatLocal(); setChatMenuOpen(false); }}>Delete chat (me)</button>
              <button className="wa-chat-menu-item wa-danger" onClick={()=> { onDeleteChatAll(); setChatMenuOpen(false); }}>Delete chat (all)</button>
              <button className="wa-chat-menu-item" onClick={()=> setChatMenuOpen(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
  <div className="wa-chat-messages-base" ref={listRef}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: 40, opacity: 0.6, fontSize: 14 }}>
            No messages yet. Start the conversation.
          </div>
        )}
        {messages.map((msg, index) => (
          <div key={index} className={`wa-message ${msg.type}`}>
            <div style={{position:'relative', width:'100%', display:'flex', justifyContent: msg.type==='sent'? 'flex-end':'flex-start'}}>
              <div className="wa-message-bubble" onContextMenu={(e)=>openContext(msg,e)} style={{fontWeight: msg.unread? 600: 400, opacity: msg.deletedAll? .6:1, fontStyle: msg.deletedAll? 'italic':'normal'}}>
                <div className="wa-message-text">{msg.deletedAll ? 'Message deleted' : msg.text}{msg.edited && !msg.deletedAll && <span style={{marginLeft:6, fontSize:10, opacity:.6}}>(edited)</span>}</div>
                <div className="wa-message-time">{new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              {!msg.deletedAll && (
                <button aria-label="Message actions" onClick={(e)=>{openContext(msg,e);}} style={{position:'absolute', top:2, right:2, background:'rgba(0,0,0,0.05)', border:'none', cursor:'pointer', color:'#333', fontSize:16, lineHeight:1, padding:'2px 6px', borderRadius:6}}>&#9662;</button>
              )}
            </div>
          </div>
        ))}
      </div>
  {/* Chat level delete buttons removed in favor of header dropdown */}
      {contextMessage && contextPos && (
        <div style={{position:'fixed', inset:0, zIndex:2000}} onClick={closeContext}>
          <div style={{position:'absolute', top:contextPos.y, left:contextPos.x, background:'#fff', padding:8, borderRadius:8, boxShadow:'0 4px 14px rgba(0,0,0,0.25)', minWidth:180, display:'flex', flexDirection:'column'}} onClick={e=>e.stopPropagation()}>
            {contextMessage.type === 'sent' && !contextMessage.deletedAll && (
              <button style={{textAlign:'left', padding:'8px 10px', background:'transparent', border:'none', cursor:'pointer'}} onClick={()=>{ setEditingMessage(contextMessage); setEditValue(contextMessage.text); closeContext(); }}>Edit</button>
            )}
            <button style={{textAlign:'left', padding:'8px 10px', background:'transparent', border:'none', cursor:'pointer'}} onClick={()=>{ onDeleteLocal(contextMessage); closeContext(); }}>Delete for me</button>
            {contextMessage.type === 'sent' && !contextMessage.deletedAll && (
              <button style={{textAlign:'left', padding:'8px 10px', background:'transparent', border:'none', cursor:'pointer', color:'#d93025'}} onClick={()=>{ onDeleteAll(contextMessage); closeContext(); }}>Delete for all</button>
            )}
            <button style={{textAlign:'left', padding:'6px 10px', background:'transparent', border:'none', cursor:'pointer'}} onClick={closeContext}>Close</button>
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
      <div className="wa-chat-input-container-base">
        <div className="wa-input-wrapper-base">
          <input
            type="text"
            placeholder="Type a message..."
            value={userMessage}
            onChange={e => setUserMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            className="wa-message-input-base"
            ref={inputRef}
            aria-label="Message input"
          />
          <button
            className="wa-send-button-base"
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
