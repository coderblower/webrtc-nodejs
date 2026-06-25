const { meetings } = require('../utils/store');

const socketHandler = (io) => {
  // Authentication middleware for sockets
  io.use((socket, next) => {
    // In production, validate JWT here
    // const token = socket.handshake.auth.token;
    // ... validation logic ...
    next();
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('join-room', ({ meetingId, role }) => {
      const meeting = meetings.get(meetingId);
      
      if (!meeting) {
        return socket.emit('error', { message: 'Meeting not found' });
      }

      socket.join(meetingId);
      socket.meetingId = meetingId;
      socket.role = role; // 'doctor' or 'patient'

      console.log(`${role} joined room: ${meetingId}`);

      // Notify others in the room
      socket.to(meetingId).emit('user-joined', { role, socketId: socket.id });

      // If both are in, we can update status
      const roomSize = io.sockets.adapter.rooms.get(meetingId)?.size;
      if (roomSize === 2) {
        meeting.status = 'active';
        io.to(meetingId).emit('meeting-active');
      }
    });

    // WebRTC Signaling Events
    socket.on('offer', (data) => {
      // Send offer to the other peer in the room
      socket.to(data.meetingId).emit('offer', {
        offer: data.offer,
        sender: socket.role
      });
    });

    socket.on('answer', (data) => {
      socket.to(data.meetingId).emit('answer', {
        answer: data.answer,
        sender: socket.role
      });
    });

    socket.on('ice-candidate', (data) => {
      socket.to(data.meetingId).emit('ice-candidate', {
        candidate: data.candidate,
        sender: socket.role
      });
    });

    socket.on('leave-room', () => {
      if (socket.meetingId) {
        socket.to(socket.meetingId).emit('user-left', { role: socket.role });
        socket.leave(socket.meetingId);
        console.log(`${socket.role} left room: ${socket.meetingId}`);
      }
    });

    socket.on('end-call', () => {
      if (socket.meetingId) {
        const meeting = meetings.get(socket.meetingId);
        if (meeting) {
          meeting.status = 'ended';
        }
        io.to(socket.meetingId).emit('call-ended');
        io.socketsLeave(socket.meetingId);
      }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
      if (socket.meetingId) {
        socket.to(socket.meetingId).emit('user-left', { role: socket.role });
      }
    });
  });
};

module.exports = socketHandler;
