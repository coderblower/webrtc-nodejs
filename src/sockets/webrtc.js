const { get, run } = require('../utils/db');

const socketHandler = (io) => {
  // Authentication middleware for sockets
  io.use((socket, next) => {
    next();
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('join-room', async ({ meetingId, role }) => {
      try {
        const meeting = await get('SELECT * FROM meetings WHERE id = ? OR joinCode = ?', [meetingId, meetingId]);
        
        if (!meeting) {
          return socket.emit('error', { message: 'Meeting not found' });
        }

        const now = new Date();
        if (meeting.startDate && now < new Date(meeting.startDate)) {
          return socket.emit('error', { message: 'Schedule yet to come' });
        }
        if (meeting.expireDate && now > new Date(meeting.expireDate)) {
          return socket.emit('error', { message: 'Schedule has expired' });
        }

        socket.join(meeting.id); // ALWAYS use the DB ID for the room, even if they joined via custom code
        socket.meetingId = meeting.id;
        socket.role = role; // 'doctor' or 'patient'

        console.log(`${role} joined room: ${meeting.id}`);

        // Notify others in the room
        socket.to(meeting.id).emit('user-joined', { role, socketId: socket.id });

        // If both are in, we can update status
        const roomSize = io.sockets.adapter.rooms.get(meeting.id)?.size;
        if (roomSize === 2) {
          await run('UPDATE meetings SET status = ? WHERE id = ?', ['active', meeting.id]);
          io.to(meeting.id).emit('meeting-active');
        }
      } catch (err) {
        console.error("Error joining room", err);
      }
    });

    // WebRTC Signaling Events
    socket.on('offer', (data) => {
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

    socket.on('request-offer', (data) => {
      socket.to(data.meetingId).emit('request-offer', {
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

    socket.on('end-call', async () => {
      if (socket.meetingId) {
        try {
          await run('UPDATE meetings SET status = ? WHERE id = ?', ['ended', socket.meetingId]);
          io.to(socket.meetingId).emit('call-ended');
          io.socketsLeave(socket.meetingId);
        } catch (err) {
          console.error(err);
        }
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
