import { useEffect, useRef, useState } from "react";

function Chat({ connectedUser, messages, typing, onSendMessage, notification, onClearNotification, onBack, onDeleteLocal, onDeleteAll, onEditMessage, onDeleteChatLocal, onDeleteChatAll }) {
  const [userMessage, setUserMessage] = useState("");
  const listRef = useRef(null);
  const [contextMessage, setContextMessage] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const inputRef = useRef(null);
  const [contextPos, setContextPos] = useState(null); // {x,y}
  const containerRef = useRef(null);
  const typingRef = useRef(false);
  const lastTypeSentRef = useRef(0);
  const stopTimeoutRef = useRef(null);

  const openContext = (msg, e) => {
    e.preventDefault();
    const PANEL_W = 200; // approximate
    const PANEL_H = 160; // approximate height; will be clamped
    const container = containerRef.current;
    if (!container) return;
    const crect = container.getBoundingClientRect();
    // click coordinates relative to container
    let x = e.clientX - crect.left;
    let y = e.clientY - crect.top;
    // Horizontal fitting (prefer right side like WhatsApp; if overflow, shift left)
    if (x + PANEL_W > crect.width - 8) {
      x = Math.max(8, x - PANEL_W);
    }
    // Vertical clamp (keep fully visible)
    if (y + PANEL_H > crect.height - 8) {
      y = Math.max(8, crect.height - PANEL_H - 8);
    }
    setContextPos({ x, y });
    setContextMessage(msg);
  };

  // After panel shows, adjust for real height if needed
  useEffect(()=> {
    if(!contextMessage || !contextPos || !containerRef.current) return;
    const panel = document.querySelector('.wa-message-options-panel.pos-abs');
    if(!panel) return;
    const crect = containerRef.current.getBoundingClientRect();
    const prect = panel.getBoundingClientRect();
    let x = contextPos.x;
    let y = contextPos.y;
    if (prect.right > crect.right - 4) {
      x = Math.max(8, x - (prect.width + 8));
    }
    if (prect.bottom > crect.bottom - 4) {
      y = Math.max(8, crect.height - prect.height - 8);
    }
    if (x !== contextPos.x || y !== contextPos.y) {
      setContextPos({x,y});
    }
  }, [contextMessage, contextPos]);

  const closeContext = () => setContextMessage(null);

  const sendMessage = () => {
    if (!userMessage.trim()) return;
    onSendMessage(userMessage.trim());
    setUserMessage("");
  // send typing stop after send
  try { window.__appSocket?.send(JSON.stringify({ type:'typing-stop', with: connectedUser.id })); } catch {}
  typingRef.current = false;
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

  // wire global socket reference (hacky but quick). Ideally pass socket or typing callbacks via props.
  useEffect(()=>{
    if (!window.__appSocket && typeof WebSocket !== 'undefined') {
      // try to detect existing sockets (not robust). Left blank intentionally.
    }
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setUserMessage(val);
    const now = Date.now();
    // Only send typing event if not already flagged or after interval
    if (!typingRef.current || (now - lastTypeSentRef.current) > 2500) {
      try { window.__appSocket?.send(JSON.stringify({ type:'typing', with: connectedUser.id })); } catch {}
      typingRef.current = true;
      lastTypeSentRef.current = now;
    }
    if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
    stopTimeoutRef.current = setTimeout(()=> {
      if (typingRef.current) {
        try { window.__appSocket?.send(JSON.stringify({ type:'typing-stop', with: connectedUser.id })); } catch {}
        typingRef.current = false;
      }
    }, 3000);
  };

  useEffect(()=>()=>{ if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current); }, []);

  return (
  <div className="wa-app-container" ref={containerRef}>
  <div className="wa-chat-header-base wa-chat-header">
        <button onClick={onBack} style={{marginRight:12, background:'transparent', border:'none', color:'#fff', cursor:'pointer', fontSize:18}} aria-label="Back to chats">←</button>
        <div className="contact-info wa-contact-info">
          <div className="contact-name wa-contact-name">{connectedUser.name} ({connectedUser.id})</div>
          <div className="contact-status wa-contact-status">{typing ? 'Typing...' : 'Online'}</div>
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
                <div className="wa-message-time">
                  {new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {msg.type==='sent' && (
                    <span style={{marginLeft:6, display:'inline-flex', alignItems:'center'}} aria-label={msg.read? 'Read': (msg.delivered? 'Delivered':'Sent')}>
                      {msg.read ? '✅✅' : msg.delivered ? '✅' : '✓'}
                    </span>
                  )}
                </div>
              </div>
              {!msg.deletedAll && (
                <button aria-label="Message actions" onClick={(e)=>{openContext(msg,e);}} className="wa-msg-action-btn">&#9662;</button>
              )}
            </div>
          </div>
        ))}
      </div>
  {/* Chat level delete buttons removed in favor of header dropdown */}
      {contextMessage && contextPos && (
        <div className="wa-message-options-chat-box" onClick={closeContext}>
          <div className="wa-message-options-panel pos-abs" style={{top:contextPos.y, left:contextPos.x}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:11, textTransform:'uppercase', letterSpacing:.5, opacity:.6, padding:'2px 4px 6px'}}>STATUS: {contextMessage.read? 'Read' : contextMessage.delivered? 'Delivered' : 'Sent'}</div>
            {contextMessage.type === 'sent' && !contextMessage.deletedAll && (
              <button className="wa-message-options-action" onClick={()=>{ setEditingMessage(contextMessage); setEditValue(contextMessage.text); closeContext(); }}>Edit</button>
            )}
            <button className="wa-message-options-action" onClick={()=>{ onDeleteLocal(contextMessage); closeContext(); }}>Delete for me</button>
            {contextMessage.type === 'sent' && !contextMessage.deletedAll && (
              <button className="wa-message-options-action danger" onClick={()=>{ onDeleteAll(contextMessage); closeContext(); }}>Delete for all</button>
            )}
            <button className="wa-message-options-action" style={{padding:'6px 10px'}} onClick={closeContext}>Close</button>
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
            onChange={handleChange}
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
