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

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') connectToUser();
  };

  return (
  <div className="wa-connect-container-base" style={{ padding: 24 }}>
      <h2 style={{ marginTop: 0 }}>Welcome {user.name} ({user.id})</h2>
      <div style={{display:'flex', gap:12, marginBottom:20}}>
  <button className="wa-connect-btn-base" onClick={() => setShowModal(true)}>
          New Chat
        </button>
      </div>
      <div style={{background:'#fff', width:'100%', maxWidth:600, borderRadius:12, padding:8, boxShadow:'0 4px 12px rgba(0,0,0,0.15)', maxHeight:'60vh', overflowY:'auto'}}>
        {chats.length === 0 && <div style={{padding:24, textAlign:'center', opacity:.65}}>No chats yet. Start one.</div>}
        {chats.map(c => (
          <div key={c.with.id} style={{position:'relative', display:'flex', cursor:'pointer', alignItems:'center', padding:'12px 14px', borderBottom:'1px solid #f0f0f0', gap:12, background: c.unread? 'rgba(37,211,102,0.08)':'transparent'}}>
            <div style={{width:44,height:44,borderRadius:'50%',background:'#25d366',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:600,fontSize:18}}>
              {c.with.name.charAt(0).toUpperCase()}
            </div>
            <div style={{flex:1}} onClick={()=>{ onOpenChat(c); }}>
              <div style={{fontWeight:600,color:'#075e54'}}>{c.with.name} <span style={{opacity:.5,fontWeight:400}}>({c.with.id})</span></div>
              <div style={{fontSize:13, color: c.unread? '#000':'#555', fontWeight: c.unread? 600:400, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:300}}>{c.lastMessage?.text}</div>
            </div>
            <div style={{textAlign:'right'}}>
              {c.lastMessage && <div style={{fontSize:11, color:'#777'}}>{new Date(c.lastMessage.time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>}
              {c.unread ? <div style={{marginTop:4, background:'#25d366', color:'#fff', fontSize:11, fontWeight:600, minWidth:18, height:18, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center'}}>{c.unread}</div>: null}
            </div>
            <button aria-label="Chat actions" onClick={(e)=>{ e.stopPropagation(); setOpenMenuChatId(id=> id===c.with.id? null: c.with.id); }} style={{marginLeft:8, background:'rgba(0,0,0,0.05)', border:'none', cursor:'pointer', padding:'4px 8px', borderRadius:6}}>&#9662;</button>
            {openMenuChatId === c.with.id && (
              <div style={{position:'absolute', top:'100%', right:10, zIndex:10}} onClick={()=> setOpenMenuChatId(null)}>
                <div style={{background:'#fff', border:'1px solid #ddd', boxShadow:'0 4px 14px rgba(0,0,0,0.15)', borderRadius:8, padding:8, minWidth:160, display:'flex', flexDirection:'column'}} onClick={e=> e.stopPropagation()}>
                  <button style={{textAlign:'left', padding:'6px 8px', background:'transparent', border:'none', cursor:'pointer', fontSize:13}} onClick={()=> { onOpenChat(c); setOpenMenuChatId(null); }}>Open chat</button>
                  {/* Future: add per-chat delete for me/all from list if required */}
                  <button style={{textAlign:'left', padding:'6px 8px', background:'transparent', border:'none', cursor:'pointer', fontSize:13}} onClick={()=> setOpenMenuChatId(null)}>Close</button>
                </div>
              </div>
            )}
          </div>
        ))}
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
