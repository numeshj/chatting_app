# Deployment Guide

## 1. Problem Summary
Your Netlify build failed to establish a WebSocket because the frontend attempted:
```
wss://intelichatting.netlify.app/
```
Netlify hosts static assets only; it does **not** provide a WebSocket backend at your site origin. You must deploy the Node WebSocket server separately and point the client to it via an environment variable.

## 2. Required Environment Variable
Set `VITE_WS_URL` at build time for the React client.

Example values:
- Production (secure): `wss://your-chat-backend.example.com`
- Development override: `ws://localhost:3001`

In Netlify UI:
1. Site settings > Build & deploy > Environment > Edit variables
2. Add: `VITE_WS_URL = wss://your-chat-backend.example.com`
3. Redeploy site.

## 3. Deploying the WebSocket Server
The server code lives in `server_asg61/server.js` and currently binds only to a fixed port (3001). For cloud platforms you need dynamic port support.

### 3.1 Minimal Express Wrapper (Optional)
If required by platform (e.g., Render, Railway) you can keep plain ws, but some prefer an HTTP server:
```js
// server_asg61/server.js (conceptual adjustment)
const http = require('http');
const WebSocket = require('ws');
const PORT = process.env.PORT || 3001;
const server = http.createServer((req,res)=>{ res.writeHead(200); res.end('OK'); });
const wss = new WebSocket.Server({ server });
// ... existing ws logic ...
server.listen(PORT, ()=> console.log('Listening', PORT));
```
This allows platforms providing only an HTTP entrypoint to still upgrade to WebSocket.

### 3.2 Suggested Hosting Options
| Platform | Notes |
|----------|-------|
| Render.com | Easy deploy from repo; auto restart; supports ws |
| Railway.app | Simple, ephemeral environments |
| Fly.io | Global regions; requires Dockerfile |
| AWS Lightsail / EC2 | Manual scaling, more control |
| Heroku alternative (e.g. Northflank) | Similar dyno model |

### 3.3 Quick Deploy (Render) Steps
1. Push repo to GitHub (already done).
2. Create new Web Service in Render, pick repo.
3. Build command: `npm install` inside `server_asg61` (may need root config)
4. Start command: `node server.js`
5. Note the assigned domain: e.g. `https://chat-ws-xyz.onrender.com`
6. Your WS URL becomes: `wss://chat-ws-xyz.onrender.com`
7. Add that to Netlify as `VITE_WS_URL`.

## 4. Local Testing With Env
Create `.env` in `client_react`:
```
VITE_WS_URL=ws://localhost:3001
```
Run:
```
npm run dev
```
Vite injects variables starting with `VITE_` into `import.meta.env`.

## 5. Fallback Logic Implemented
The app now only auto-connects to localhost if hostname is `localhost` or `127.0.0.1`. Otherwise it requires `VITE_WS_URL` and logs:
```
WebSocket disabled: define VITE_WS_URL env variable pointing to deployed server.
```
This prevents futile attempts to connect to the static site origin.

## 6. Verify in Browser Console
After deploying with correct variable, you should see:
```
WebSocket connection opened to wss://your-chat-backend.example.com
```
(You can add an explicit `socket.current.addEventListener('open', ()=>console.log('WS open'))` if desired.)

## 7. Optional Hard Health Endpoint
Add a simple GET handler (see section 3.1) so visiting the backend URL in a browser returns 200 OK.

## 8. Production Recommendations
| Aspect | Recommendation |
|--------|---------------|
| SSL | Always use `wss://` via platform-managed certificate |
| CORS / Origin | For raw ws typically open; can implement origin check if needed |
| Scaling | Single instance fine for demo; use sticky sessions if sharding later |
| Persistence | Add DB or Redis for real history |
| Logging | Add structured logs (pino / winston) |

## 9. Troubleshooting Table
| Symptom | Cause | Fix |
|---------|-------|-----|
| `failed: Error in connection establishment` | Wrong domain / server not running | Verify server URL & port open |
| Hangs on connect | Firewall or missing `VITE_WS_URL` | Inspect console warning |
| Works locally not prod | Not using deployed wss endpoint | Set env var on Netlify |
| Mixed content error | Using `ws://` on https site | Use `wss://` |

## 10. Next Enhancements
- Add retry/backoff for transient WS disconnects
- Heartbeat ping/pong + offline detection
- Show "Reconnecting..." banner

---
Generated deployment guide.
