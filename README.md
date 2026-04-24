# StreamVox/StreamSync — Signaling Server

Node.js + Socket.IO signaling server for realtime voice streaming between StreamVox (sender) and StreamSync (receiver) apps.

## Deploy to Railway

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub**
3. Select this repo
4. Add environment variables:
   - `PORT` = `3001` (Railway auto-sets this, usually not needed)
5. **Upload your `serviceAccountKey.json`**: 
   - Go to Railway dashboard → Variables
   - Add `GOOGLE_APPLICATION_CREDENTIALS_JSON` with the **entire JSON content** of your service account key
   - Or place `serviceAccountKey.json` in the root (not recommended for public repos)

## Local Development

```bash
npm install
# Place serviceAccountKey.json in this directory
npm start
# Server runs at http://localhost:3001
```

## API

- `GET /` — Server info
- `GET /health` — Health check with active room count

## Socket.IO Events

| Event | Direction | Data |
|-------|-----------|------|
| `receiver-ready` | Receiver → Server → Sender | `{ roomId }` |
| `start-stream` | Server → Sender | — |
| `offer` | Sender → Server → Receiver | `{ sdp, roomId }` |
| `answer` | Receiver → Server → Sender | `{ sdp, roomId }` |
| `ice-candidate` | Both → Server → Peer | `{ candidate, roomId }` |
| `end-call` | Either → Server → Peer | `{ roomId }` |
| `call-ended` | Server → Peer | — |
| `peer-disconnected` | Server → Peer | — |

## Security

- Firebase JWT verified on every socket connection
- Room ID = SHA256(user email) — validated server-side
- Mismatched room IDs rejected
