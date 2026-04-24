require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');
const admin = require('./firebase-admin');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// ─── Utilities ───────────────────────────────────────────────────
const sha256 = (str) => crypto.createHash('sha256').update(str).digest('hex');

// Track connected sockets per room for debugging
const rooms = new Map();

// ─── Auth Middleware ─────────────────────────────────────────────
// Runs on every socket connection — verifies Firebase JWT
io.use(async (socket, next) => {
  const { token, roomId, role } = socket.handshake.auth;

  // Validate required fields
  if (!token || !roomId || !role) {
    console.log('❌ Connection rejected: Missing auth fields');
    return next(new Error('Missing authentication fields (token, roomId, role)'));
  }

  // Validate role
  if (!['sender', 'receiver'].includes(role)) {
    console.log(`❌ Connection rejected: Invalid role "${role}"`);
    return next(new Error('Invalid role. Must be "sender" or "receiver"'));
  }

  try {
    // Verify Firebase ID token
    const decoded = await admin.auth().verifyIdToken(token);

    // Compute expected room ID from decoded email
    const expectedRoom = sha256(decoded.email.toLowerCase().trim());

    // Room ID must match
    if (expectedRoom !== roomId) {
      console.log(`❌ Room ID mismatch for ${decoded.email}`);
      return next(new Error('Room ID mismatch — email does not correspond to claimed room'));
    }

    // Attach user data to socket
    socket.userEmail = decoded.email;
    socket.roomId = roomId;
    socket.role = role;
    socket.uid = decoded.uid;

    console.log(`✅ Auth verified: [${role}] ${decoded.email} → room ${roomId.slice(0, 8)}...`);
    next();
  } catch (err) {
    console.log(`❌ Token verification failed: ${err.message}`);
    next(new Error('Invalid or expired Firebase token'));
  }
});

// ─── Socket Events ───────────────────────────────────────────────
io.on('connection', (socket) => {
  const { roomId, role, userEmail } = socket;

  // Join the room
  socket.join(roomId);

  // Track room membership
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }
  rooms.get(roomId).add(socket.id);

  console.log(`🔗 [${role}] joined room ${roomId.slice(0, 8)}... (${rooms.get(roomId).size} in room)`);

  // ── Receiver signals readiness → tell Sender to start streaming ──
  socket.on('receiver-ready', ({ roomId }) => {
    console.log(`📡 [receiver] ready in room ${roomId.slice(0, 8)}...`);
    socket.to(roomId).emit('start-stream');
  });

  // ── WebRTC SDP Offer (Sender → Receiver) ──
  socket.on('offer', ({ sdp, roomId }) => {
    console.log(`📤 [sender] sent offer to room ${roomId.slice(0, 8)}...`);
    socket.to(roomId).emit('offer', sdp);
  });

  // ── WebRTC SDP Answer (Receiver → Sender) ──
  socket.on('answer', ({ sdp, roomId }) => {
    console.log(`📥 [receiver] sent answer to room ${roomId.slice(0, 8)}...`);
    socket.to(roomId).emit('answer', sdp);
  });

  // ── ICE Candidate Exchange (both directions) ──
  socket.on('ice-candidate', ({ candidate, roomId }) => {
    socket.to(roomId).emit('ice-candidate', candidate);
  });

  // ── End Call (either side) ──
  socket.on('end-call', ({ roomId }) => {
    console.log(`📴 [${role}] ended call in room ${roomId.slice(0, 8)}...`);
    socket.to(roomId).emit('call-ended');
  });

  // ── Disconnect ──
  socket.on('disconnect', (reason) => {
    // Notify peers
    socket.to(roomId).emit('peer-disconnected');

    // Clean up room tracking
    if (rooms.has(roomId)) {
      rooms.get(roomId).delete(socket.id);
      if (rooms.get(roomId).size === 0) {
        rooms.delete(roomId);
      }
    }

    console.log(`🔌 [${role}] disconnected from room ${roomId.slice(0, 8)}... (reason: ${reason})`);
  });
});

// ─── Health Check ────────────────────────────────────────────────
app.get('/health', (_, res) => {
  res.json({
    status: 'ok',
    activeRooms: rooms.size,
    timestamp: new Date().toISOString(),
  });
});

app.get('/', (_, res) => {
  res.json({
    service: 'RealtimeVoiceBridge Signaling Server',
    status: 'running',
    version: '1.0.0',
  });
});

// ─── Start Server ────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('  🎙️  RealtimeVoiceBridge Signaling Server');
  console.log(`  🌐  Listening on port ${PORT}`);
  console.log(`  🏥  Health check: http://localhost:${PORT}/health`);
  console.log('═══════════════════════════════════════════════════');
  console.log('');
});
