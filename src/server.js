require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const meetingRoutes = require('./routes/meetings');
const socketHandler = require('./sockets/webrtc');

const app = express();
const server = http.createServer(app);

// Configure Socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: '*', // In production, replace with your specific Web/App domains
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Serve static files from public directory for the web iframe version
app.use(express.static('public'));

// REST Routes
app.use('/api/meetings', meetingRoutes);

// Health Check Endpoint
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

// Initialize WebRTC Signaling Sockets
socketHandler(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`WebRTC Signaling Server running on port ${PORT}`);
});
