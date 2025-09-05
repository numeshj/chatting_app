## Chatting App (React + Vite)

Single page chat UI powered by a custom WebSocket server (`server_asg61`).

### Development

From repository root in two terminals:

1. Backend:
   ```bash
   cd server_asg61
   npm install
   npm start
   ```
2. Frontend:
   ```bash
   cd client_react
   npm install
   npm run dev
   ```

Open the printed Vite local URL (default http://localhost:5173).

### Production Build
```bash
cd client_react
npm run build
```
Outputs to `client_react/dist`.

### Netlify Deployment

The repo contains a root `netlify.toml` so Netlify auto-detects settings.

Build settings (if entering manually in Netlify UI):
- Base directory: `client_react`
- Build command: `npm run build`
- Publish directory: `client_react/dist`

`netlify.toml` snippet:
```
[build]
base = "client_react"
publish = "client_react/dist"
command = "npm install && npm run build"

[[redirects]]
from = "/*"
to = "/index.html"
status = 200
```

This redirect enables SPA deep linking.

### Reconnection & Unread Features
- Auto login (localStorage)
- Unread badges & ordering
- Reconnect same ID+name without rejection

### Future Ideas
- Persist messages server-side (DB)
- Typing indicators
- Authentication

---
Generated from modified Vite template.
