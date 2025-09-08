import { useState } from "react";

function Connect({ user, onConnectToUser, chats = [], onOpenChat }) {
  const [showModal, setShowModal] = useState(false);
  const [connectName, setConnectName] = useState("");
  const [connectId, setConnectId] = useState("");
  const [openMenuChatId, setOpenMenuChatId] = useState(null);

  const connectToUser = () => {
    if (!connectName.trim() || !connectId.trim()) return;
    onConnectToUser(connectName.trim(), parseInt(connectId));
    setShowModal(false);
    setConnectName("");
    setConnectId("");
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter') connectToUser(); };

  return (
    <div className="wa-connect-container-base">
      <h2 className="wa-connect-heading">Welcome {user.name} ({user.id})</h2>
      <div className="wa-connect-actions">
        <button className="wa-connect-btn-base" onClick={() => setShowModal(true)}>New Chat</button>
      </div>
      <div className="wa-chat-list">
        {chats.length === 0 && <div className="wa-chat-list-empty">No chats yet. Start one.</div>}
        {chats.map(c => {
          const itemCls = `wa-chat-list-item${c.unread ? ' unread' : ''}`;
          const lastMsgCls = `wa-chat-item-last${c.unread ? ' unread' : ''}`;
          return (
            <div key={c.with.id} className={itemCls}>
              <div className="wa-chat-avatar">{c.with.name.charAt(0).toUpperCase()}</div>
              <div className="wa-chat-item-main" onClick={()=>{ onOpenChat(c); }}>
                <div className="wa-chat-item-name">{c.with.name} <span className="wa-chat-item-id">({c.with.id})</span></div>
                <div className={lastMsgCls}>{c.lastMessage?.text}</div>
              </div>
              <div className="wa-chat-item-meta">
                {c.lastMessage && <div className="wa-chat-item-time">{new Date(c.lastMessage.time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>}
                {c.unread ? <div className="wa-chat-item-unread-badge">{c.unread}</div>: null}
              </div>
              <button aria-label="Chat actions" className="wa-chat-item-menu-btn" onClick={(e)=>{ e.stopPropagation(); setOpenMenuChatId(id=> id===c.with.id? null: c.with.id); }}>&#9662;</button>
              {openMenuChatId === c.with.id && (
                <div className="wa-chat-item-menu-wrapper" onClick={()=> setOpenMenuChatId(null)}>
                  <div className="wa-chat-item-menu" onClick={e=> e.stopPropagation()}>
                    <button className="wa-chat-item-menu-action" onClick={()=> { onOpenChat(c); setOpenMenuChatId(null); }}>Open chat</button>
                    <button className="wa-chat-item-menu-action" onClick={()=> setOpenMenuChatId(null)}>Close</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {showModal && (
        <div className="wa-modal-base">
          <div className="wa-modal-content-base" style={{ animation: 'fadeInUp .4s ease' }}>
            <h3 style={{ marginTop: 0 }}>Connect to User</h3>
            <input
              value={connectName}
              onChange={e => setConnectName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="User name"
              className="wa-modal-input-base"
            />
            <input
              value={connectId}
              onChange={e => setConnectId(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="User ID"
              className="wa-modal-input-base"
              type="number"
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button className="wa-modal-close-base" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className="wa-modal-btn-base" onClick={connectToUser} disabled={!connectName.trim() || !connectId.trim()}>
                Connect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Connect;
