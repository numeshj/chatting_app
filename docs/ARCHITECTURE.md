# WhatsApp Clone Architecture & Feature Documentation

## 1. Overview
A lightweight WhatsApp-like realtime chat application built with:
- **Frontend**: React 19 + Vite (single-page app)
- **Backend**: Node.js WebSocket server (`ws` library)
- **Transport**: Raw WebSocket JSON messages (no REST endpoints)
- **State Persistence (client)**: `localStorage` for chats/messages cache & last user session
- **Animations**: `lottie-react` for inbound message toast
- **Styling**: Custom CSS (scoped with `wa-*` prefixes) for an isolated, phone-sized UI

The system intentionally avoids a database; all messages live in server memory (ephemeral). Clients keep their own local copies for resilience within a session.

## 2. High-Level Architecture Diagram
```
+---------------------+        WebSocket        +-------------------------+
|  React Client (SPA) | <---------------------> |  Node.js WS Server (ws) |
|  - Login            |                        |  - Session registry     |
|  - Chat List        |                        |  - In‑memory messages   |
|  - Chat Window      |                        |  - Event routing        |
|  - Notifications    |                        |  - Status propagation   |
+----------+----------+                        +------------+------------+
           |  localStorage (per browser)                    |
           +-----------------------------------------------+
```

## 3. Data Model (In-Memory Server Structures)
- `users: Map<number, { name: string, ws: WebSocket }>` Active sessions (one per ID; reconnect replaces previous)
- `messages: Map<string, Message[]>` Key is `conversationKey = sort([id1,id2]).join('-')`
- `Message` shape:
```jsonc
{
  "type": "message",        // event type
  "text": "hello",          // content
  "source": {"id":1, "name":"Alice"},
  "destination": 2,          // numeric id
  "time": "2025-09-08T08:23:10.123Z",
  "messageId": "lmn8xkabc12", // unique
  "delivered": true|false,
  "read": true|false,
  "edited": true|false,      // optional
  "timeEdited": "..."        // optional
}
```

## 4. Frontend State Model (Key React State)
| State | Purpose |
|-------|---------|
| `user` | Logged-in identity {id,name} |
| `connectedUser` | Currently open chat partner |
| `messages` | Message list for open conversation |
| `chats` | Array of conversation summaries: `{ with:{id,name}, lastMessage, unread }` |
| `incomingMessage` | Last off-screen incoming notification payload |
| `typingFrom` | User ID currently typing to me (for active chat) |

`localStorage` keys:
- `lastUser` -> persisted login {id,name}
- `cachedChats` -> serialized `chats` array
- `<convKey>` -> per conversation message array
- `<convKey>:hidden` -> message IDs locally removed (delete-for-me)

## 5. WebSocket Event Contract
All messages use JSON objects with a `type` field.

### 5.1 Client -> Server Events
| Type | Payload | Purpose |
|------|---------|---------|
| `connect` | `{ type, id, name }` | Register / login (replaces prior session with same ID) |
| `lookup-user` | `{ type, id }` | Validate existence (online) of target user ID |
| `get-messages` | `{ type, withId }` | Fetch full conversation history; server also marks messages to this user as delivered |
| `message` | `{ type, text, destination }` | Send new message (server sets id/time, echoes back) |
| `mark-read` | `{ type, with }` | Mark all messages from `with` to me as delivered+read |
| `delete-message` | `{ type, messageId, with, scope:'all'|'me' }` | Delete globally (if sender) or locally |
| `edit-message` | `{ type, messageId, with, newText }` | Edit previously sent message (sender only) |
| `delete-chat` | `{ type, with, scope:'all'|'me' }` | Delete entire chat (global removes messages) |
| `typing` | `{ type, with }` | User started / continues typing to `with` |
| `typing-stop` | `{ type, with }` | User stopped typing |

### 5.2 Server -> Client Events
| Type | Payload | Notes |
|------|---------|-------|
| `connect-done` | `{ type, id, name }` | Successful login |
| `session-replaced` | `{ type }` | Old socket is being invalidated by new login |
| `connect-error` | `{ type, message }` | Login failed (currently unused for duplicate due to replacement logic) |
| `conversation-summaries` | `{ type, conversations:[{with:{id,name}, lastMessage}] }` | Initial summaries after login if history exists |
| `user-info` | `{ type, exists, id, name? }` | Lookup response |
| `messages` | `{ type, messages:[Message] }` | Full conversation list |
| `message` | `Message` | New or echoed message (canonical source) |
| `message-status` | `{ type, messageId, status:'delivered'|'read', with }` | Status update for sender's copy |
| `message-removed` | `{ type, messageId, with }` | Global deletion notice |
| `message-edited` | `{ type, messageId, newText, with, timeEdited }` | Edit propagation |
| `chat-deleted` | `{ type, with }` | Chat purged globally |
| `message-deleted-local` | `{ type, messageId }` | Optional ack for local-only delete |
| `typing` | `{ type, from }` | Partner typing indicator |
| `typing-stop` | `{ type, from }` | Partner stopped typing |

## 6. Feature Flows

### 6.1 Registration / Login
1. User enters name + numeric ID.
2. Client sends `connect`.
3. Server disconnects any previous socket for that ID, registers new one, replies `connect-done` + optional `conversation-summaries`.
4. Client stores `lastUser` in `localStorage` for auto-login.

### 6.2 Auto-Login
- On app mount, if `lastUser` exists, automatically re-sends `connect` using saved credentials once socket opens.

### 6.3 User Lookup (New Chat)
1. User opens New Chat modal, enters target ID.
2. Client sends `lookup-user`.
3. Server responds `user-info {exists:true|false}`.
4. If exists, Chat button enabled; clicking opens conversation via `connectToUser` (which fetches messages).

### 6.4 Opening a Conversation
1. Client sets `connectedUser` and loads cached messages from `<convKey>`.
2. Sends `get-messages` (server responds with full list and marks inbound messages as delivered).
3. Sends `mark-read` to promote delivered->read for messages just viewed.

### 6.5 Sending Messages
1. Client sends `message {text, destination}`.
2. Server creates canonical message object, stores it, transmits to destination (if online) and echoes to sender.
3. Upon delivering to destination, server sets `payload.delivered=true` and sends a `message-status` back to sender (echo's copy already mutated locally through event stream logic).
4. If receiver's chat is open, receiver immediately responds with `mark-read` (or client does it proactively), server emits `message-status status='read'`.

### 6.6 Message Delivery & Read Receipts
- Delivery: Set when server successfully sends message to online destination or destination fetches history via `get-messages`.
- Read: Set when destination issues `mark-read` (triggered automatically on opening chat or on live receipt while open).
- Client updates UI tick icons:
  - `✓` (sent only)
  - `✅` (delivered)
  - `✅✅` (read)

### 6.7 Editing a Message
1. Sender invokes edit from context menu.
2. Client sends `edit-message`.
3. Server validates ownership; updates message; broadcasts `message-edited` to both sides.
4. Client marks message with `(edited)` label and updates text.

### 6.8 Deleting a Message
- Delete for Me (`scope:'me'`): Client locally removes message & hides it via `<convKey>:hidden` list.
- Delete for All (`scope:'all'`): Server validates sender ownership; removes from array; notifies both with `message-removed`.

### 6.9 Deleting a Chat
- Local: Remove cached and in-memory UI state only.
- Global (`scope:'all'`): Server deletes entire conversation key, notifies both with `chat-deleted`.

### 6.10 Online Status
- Simplified: If user is connected via WebSocket, they are considered "Online" (no presence timeout). UI shows constant Online or dynamic Typing override.

### 6.11 Typing Indicator
1. While user types, client throttles `typing` events (≈ every 2.5s or on start) to server.
2. After inactivity (3s) or on send, client sends `typing-stop`.
3. Server forwards `typing` / `typing-stop` to the other user.
4. Receiving client sets `typingFrom` and displays `Typing...` until timeout or explicit stop.

### 6.12 Notifications (Lottie Toast)
- If an incoming message arrives for a chat that's not currently open, `incomingMessage` is set and a Lottie toast appears.
- Clicking toast dismisses it (and could focus chat if extended later).

## 7. Conversation Key Logic
`convKey = [id1, id2].sort().join('-')` ensures both users refer to the same entry regardless of order.

## 8. Local Persistence Strategy
| Item | Persistence | Rationale |
|------|-------------|-----------|
| Messages per chat | `<convKey>` | Re-load after refresh |
| Hidden message IDs | `<convKey>:hidden` | Preserve local-only deletions |
| Current user | `lastUser` | Auto-login convenience |
| Chats list | `cachedChats` | Faster initial render |

## 9. Security / Limitations
- No authentication tokens or password; identity is numeric ID + arbitrary display name.
- No rate limiting or flood protection.
- Memory-store only: server restart erases history.
- No encryption (plaintext WebSocket over ws://).

## 10. Extensibility Ideas
| Feature | Approach |
|---------|----------|
| Persist to DB | Replace in-memory maps with a persistence layer (e.g., PostgreSQL or Redis) |
| Multi-device sync | Allow parallel sockets per user ID (store array instead of single ws) |
| Presence (last seen) | Track `lastActive` timestamp on ping/close, broadcast presence events |
| Media messages | Extend message schema with `kind` + blob URLs / upload service |
| Infinite scroll | Add pagination parameters to `get-messages` |
| Auth | Add login API issuing JWT, verify on WS connection upgrade |

## 11. UI Component Map
| Component | Responsibility |
|-----------|----------------|
| `Login.jsx` | User entry (ID + name) with auto-focus |
| `Connect.jsx` | Chat list, new chat modal (ID lookup), unread highlighting |
| `Chat.jsx` | Active conversation, message rendering, context menus, typing indicator |
| `NotificationToast.jsx` | Lottie-based notification popup |
| `App.jsx` | Global state orchestration, WebSocket lifecycle, event routing |

## 12. Message Status Logic Summary
1. Send -> optimistic ticks withheld until echo.
2. Server echo provides canonical message, added to local state.
3. Delivery triggers `message-status` (delivered) if destination online or later via history fetch.
4. Read triggers `message-status` (read) upon `mark-read`.

## 13. Event Sequence Example
```
User A sends text to B
A -> Server: {type:message, text, destination:B}
Server stores + echoes to A + forwards to B (if online)
Server -> A: {type:message, delivered:true? maybe after forward}
Server -> A: {type:message-status, status:delivered}
Server -> B: {type:message, delivered:false}
B opens chat (or already open) -> sends mark-read
B -> Server: {type:mark-read, with:A}
Server -> A: {type:message-status, status:read, messageId}
```

## 14. Typing Indicator Timing
- Send `typing` at start and every ~2.5s while active.
- Auto `typing-stop` after 3s idle or message send.
- Receiver clears after 4s fallback if no further signals.

## 15. Build & Deployment Notes
Build client:
```
npm run build (inside client_react)
```
Outputs to `client_react/dist/` (static assets). A simple static server (or Vite preview) can host it. Server runs separately:
```
node server_asg61/server.js
```
(Ensure port 3001 open; client expects `ws://localhost:3001`).

## 16. Known Trade-offs
| Area | Trade-off |
|------|-----------|
| Single session per ID | Simplifies state; last login wins |
| No DB | Faster iteration, loses persistence |
| Window global socket for typing | Quick integration; should be refactored to React context |
| Unstructured status values | Couple logic to booleans; good enough for MVP |

## 17. File / Path Reference
| Path | Purpose |
|------|---------|
| `client_react/src/App.jsx` | Core orchestrator & socket events |
| `client_react/src/components/Login.jsx` | Login form |
| `client_react/src/components/Connect.jsx` | Chats + new chat modal |
| `client_react/src/components/Chat.jsx` | Active chat UI |
| `client_react/src/components/NotificationToast.jsx` | Notification UI |
| `server_asg61/server.js` | WebSocket backend |
| `docs/ARCHITECTURE.md` | This document |

## 18. Testing Suggestions (Future)
| Concern | Suggested Test |
|---------|----------------|
| Delivery receipts | Simulate online/offline receiver states |
| Read receipts | Mark-read on open vs. not open |
| Typing | Ensure stop event fires on inactivity |
| Edit/Delete | Ownership validation & UI update |
| Reconnect | Ensure session-replaced old socket closes |

## 19. Glossary
| Term | Definition |
|------|------------|
| Conversation Key | Deterministic sorted ID pair string |
| Hidden Messages | Locally removed messages (delete-for-me) |
| Echo | Server re-sending a message to origin to ensure canonical data |

---
Generated automatically. Update as features evolve.
