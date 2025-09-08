import { useState, useRef, useEffect } from "react";

function Login({ onConnect }) {
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [connectError, setConnectError] = useState("");
  const nameInputRef = useRef(null);

  const handleConnect = () => {
    if (!name.trim() || !id.trim()) return;
    onConnect(name.trim(), parseInt(id), setConnectError);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleConnect();
    }
  };

  useEffect(()=>{
    // focus name input on mount
    const t = setTimeout(()=>{ nameInputRef.current?.focus(); }, 20);
    return ()=> clearTimeout(t);
  }, []);

  // login

  return (
    <div className="wa-login-outer-base">
      <div className="wa-login-card-base">
        <div className="wa-login-header-base">WhatsApp Clone</div>
        <div className="wa-login-sub-base">Enter a display name and numeric ID.</div>
        <div className="wa-login-fields-base">
          <input
            ref={nameInputRef}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Display name"
            className="wa-login-input-base"
            onKeyDown={handleKeyDown}
          />
          <input
            value={id}
            onChange={e => setId(e.target.value)}
            placeholder="Your numeric ID"
            className="wa-login-input-base"
            type="number"
            onKeyDown={handleKeyDown}
          />
        </div>
        {connectError && <p className="wa-error-base" role="alert">{connectError}</p>}
        <button className="wa-login-btn-base" onClick={handleConnect} disabled={!name.trim() || !id.trim()}>
          Connect
        </button>
      </div>
    </div>
  );
}

export default Login;
