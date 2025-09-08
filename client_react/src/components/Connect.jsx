import { useRef, useState, useEffect } from "react";

function Connect({ user, onConnectToUser, chats = [], onOpenChat, lookupUser }) {
  const [showModal, setShowModal] = useState(false);
  const [connectName, setConnectName] = useState(""); // resolved from lookup
  const [connectId, setConnectId] = useState("");
  const [lookupState, setLookupState] = useState('idle'); // idle|loading|found|missing
  const [lookupError, setLookupError] = useState("");
  const [openMenuChatId, setOpenMenuChatId] = useState(null);
  const [menuPos, setMenuPos] = useState(null); // final {x,y} for menu
  const [menuAnchor, setMenuAnchor] = useState(null); // raw click {x,y}
  const [menuSide, setMenuSide] = useState('right'); // 'right' or 'left'
  const containerRef = useRef(null);
  const modalInputRef = useRef(null);

  const connectToUser = () => {
    if (lookupState !== 'found') return;
    onConnectToUser(connectName, parseInt(connectId));
    setShowModal(false);
    setConnectName("");
    setConnectId("");
    setLookupState('idle');
    setLookupError("");
  };

  const doLookup = async () => {
    setLookupError("");
    if (!connectId.trim()) return;
    setLookupState('loading');
    try {
      const info = await lookupUser(parseInt(connectId));
      if (info.exists) {
        setConnectName(info.name);
        setLookupState('found');
      } else {
        setConnectName("");
        setLookupState('missing');
        setLookupError('User ID not found');
      }
    } catch {
      setLookupState('idle');
      setLookupError('Lookup failed');
    }
  };

  // Refine menu position after render to keep within container and decide left/right placement
  useEffect(()=>{
    if(openMenuChatId==null || !menuAnchor || !containerRef.current) return;
    const container = containerRef.current;
    const crect = container.getBoundingClientRect();
    const PANEL_W = 200;
    const PANEL_H_MIN = 90;
    // Default prefer right side of anchor
  let xRight = menuAnchor.x + 8;
  let xLeft = menuAnchor.x - PANEL_W - 8;
  let useLeft = false;
  if (xRight + PANEL_W > crect.width - 8 && xLeft >= 8) useLeft = true;
  const finalX = useLeft ? Math.max(8, xLeft) : Math.min(xRight, crect.width - PANEL_W - 8);
    // vertical
    let finalY = menuAnchor.y - 10; // slightly above click like WhatsApp
    if (finalY + PANEL_H_MIN > crect.height - 8) finalY = crect.height - PANEL_H_MIN - 8;
    if (finalY < 8) finalY = 8;
  setMenuSide(useLeft? 'left':'right');
  setMenuPos({x: finalX, y: finalY});
  }, [openMenuChatId, menuAnchor]);

  const handleKeyDown = (e) => { if (e.key === 'Enter') { lookupState==='found'? connectToUser(): doLookup(); } };

  // Focus input automatically when modal opens
  useEffect(()=>{
    if(showModal) {
      // delay to allow animation / render
      const t = setTimeout(()=>{ modalInputRef.current?.focus(); modalInputRef.current?.select(); }, 10);
      return ()=> clearTimeout(t);
    }
  }, [showModal]);

  return (
  <div className="wa-connect-container-base" ref={containerRef}>
      <h2 className="wa-connect-heading">Welcome {user.name} ({user.id})</h2>
      <div className="wa-connect-actions">
        <button className="wa-connect-btn-base" onClick={() => setShowModal(true)}>New Chat</button>
      </div>
      <div className="wa-chat-list">
        {(!chats || chats.length === 0) && <div className="wa-chat-list-empty">No chats yet. Start one.</div>}
        {(chats||[]).filter(c => c && c.with && c.with.name && (typeof c.with.id !== 'undefined')).map(c => {
          const itemCls = `wa-chat-list-item${c.unread ? ' unread' : ''}`;
          const lastMsgCls = `wa-chat-item-last${c.unread ? ' unread' : ''}`;
          return (
            <div key={c.with.id} className={itemCls}>
              <div className="wa-chat-avatar">{(c.with.name?.[0] || '?').toUpperCase()}</div>
              <div className="wa-chat-item-main" onClick={()=>{ onOpenChat(c); }}>
                <div className="wa-chat-item-name">{c.with.name} <span className="wa-chat-item-id">({c.with.id})</span></div>
                <div className={lastMsgCls}>
                  {c.lastMessage ? (
                    <>
                      {c.lastMessage.type==='sent' && <span style={{marginRight:4}}>{c.lastMessage.read? '✅✅' : c.lastMessage.delivered? '✅' : '✓'}</span>}
                      {c.lastMessage.text}
                    </>
                  ) : ''}
                </div>
              </div>
              <div className="wa-chat-item-meta">
                {c.lastMessage && <div className="wa-chat-item-time">{new Date(c.lastMessage.time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>}
                {c.unread ? <div className="wa-chat-item-unread-badge">{c.unread}</div>: null}
              </div>
              <button aria-label="Chat actions" className="wa-chat-item-menu-btn" onClick={(e)=>{ 
                e.stopPropagation();
                const idAlready = openMenuChatId === c.with.id;
                setOpenMenuChatId(idAlready? null : c.with.id);
                if(idAlready) { setMenuPos(null); setMenuAnchor(null); return; }
                const container = containerRef.current;
                if(container){
                  const crect = container.getBoundingClientRect();
                  const ax = e.clientX - crect.left; // anchor click inside container
                  const ay = e.clientY - crect.top;  // anchor click inside container
                  setMenuAnchor({x: ax, y: ay});
                  // provisional position (will refine in effect)
                  setMenuPos({x: ax, y: ay});
                }
              }}>&#9662;</button>
            </div>
          );
        })}
      </div>
      {openMenuChatId !== null && menuPos && (()=>{
        const chat = (chats||[]).find(c=> c.with.id===openMenuChatId);
        if(!chat) return null;
        return (
          <div className="wa-chat-menu-pop" onClick={()=> setOpenMenuChatId(null)}>
            <div className={`wa-chat-item-menu wa-chat-item-menu--${menuSide}`} style={{top:menuPos.y, left:menuPos.x}} onClick={e=> e.stopPropagation()}>
              <button className="wa-chat-item-menu-action" onClick={()=> { onOpenChat(chat); setOpenMenuChatId(null); }}>Open chat</button>
              <button className="wa-chat-item-menu-action" onClick={()=> setOpenMenuChatId(null)}>Close</button>
            </div>
          </div>
        );
      })()}
      {showModal && (
        <div className="wa-modal-base">
          <div className="wa-modal-content-base" style={{ animation: 'fadeInUp .4s ease' }}>
            <h3 style={{ marginTop: 0 }}>Start New Chat</h3>
            <input
              ref={modalInputRef}
              value={connectId}
              onChange={e => { setConnectId(e.target.value); setLookupState('idle'); setLookupError(''); }}
              onKeyDown={handleKeyDown}
              placeholder="Enter User ID"
              className="wa-modal-input-base"
              type="number"
            />
            {lookupState==='found' && <div style={{marginTop:4, fontSize:14, color:'#075e54'}}>User: {connectName}</div>}
            {lookupState==='missing' && <div style={{marginTop:4, fontSize:13, color:'#d93025'}}>{lookupError}</div>}
            {lookupState==='idle' && connectId && <div style={{marginTop:4, fontSize:12, opacity:.6}}>Press Enter or Lookup</div>}
            {lookupState==='loading' && <div style={{marginTop:4, fontSize:12}}>Looking up...</div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 12 }}>
              <button className="wa-modal-close-base" onClick={() => setShowModal(false)}>Cancel</button>
              {lookupState!=='found' && <button className="wa-modal-btn-base" onClick={doLookup} disabled={!connectId.trim() || lookupState==='loading'}>Lookup</button>}
              {lookupState==='found' && <button className="wa-modal-btn-base" onClick={connectToUser}>Chat</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Connect;
