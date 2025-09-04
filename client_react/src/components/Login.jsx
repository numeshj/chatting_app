import { useState } from "react";

function Login({ onConnect }) {
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [connectError, setConnectError] = useState("");

  const handleConnect = () => {
    if (!name.trim() || !id.trim()) return;
    onConnect(name.trim(), parseInt(id), setConnectError);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleConnect();
    }
  };

  return (
    <div className="login-outer">
      <div className="login-card">
        <div className="login-header">WhatsApp Clone</div>
        <div className="login-sub">Enter a display name and numeric ID.</div>
        <div className="login-fields">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Display name"
            className="login-input"
            onKeyDown={handleKeyDown}
          />
          <input
            value={id}
            onChange={e => setId(e.target.value)}
            placeholder="Your numeric ID"
            className="login-input"
            type="number"
            onKeyDown={handleKeyDown}
          />
        </div>
        {connectError && <p className="error" role="alert">{connectError}</p>}
        <button className="login-btn" onClick={handleConnect} disabled={!name.trim() || !id.trim()}>
          Connect
        </button>
      </div>
    </div>
  );
}

export default Login;
