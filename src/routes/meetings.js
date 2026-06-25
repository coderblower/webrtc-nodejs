const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { meetings } = require('../utils/store');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Doctor creates a meeting
router.post('/create', authMiddleware, (req, res) => {
  // In production, you would uncomment this check:
  // if (req.user.role !== 'doctor') return res.status(403).json({ error: 'Only doctors can create meetings' });

  const meetingId = uuidv4();
  const joinCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code for easy mobile entry
  
  meetings.set(meetingId, {
    id: meetingId,
    joinCode,
    doctorId: req.user.id,
    patientId: null,
    createdAt: new Date(),
    status: 'waiting' // 'waiting', 'active', 'ended'
  });

  res.json({
    success: true,
    meetingId,
    joinCode
  });
});

// Validate meeting exists before joining
router.get('/:idOrCode', (req, res) => {
  const { idOrCode } = req.params;
  // Search by ID or 6-digit join code
  let meeting = meetings.get(idOrCode);
  
  if (!meeting) {
    meeting = Array.from(meetings.values()).find(m => m.joinCode === idOrCode);
  }

  if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
  if (meeting.status === 'ended') return res.status(400).json({ error: 'Meeting has ended' });

  res.json({
    success: true,
    meetingId: meeting.id,
    status: meeting.status
  });
});

// Patient joins (REST part, real join is via Socket)
router.post('/join', (req, res) => {
  const { joinCode } = req.body;
  
  const meeting = Array.from(meetings.values()).find(m => m.joinCode === joinCode);
  
  if (!meeting) return res.status(404).json({ error: 'Invalid meeting code' });
  if (meeting.status === 'ended') return res.status(400).json({ error: 'Meeting has ended' });
  
  // Usually, we'd record the patient's ID here, but WebRTC signaling handles the actual connection.
  // This is just to validate and get the full meeting ID before socket connection.
  res.json({
    success: true,
    meetingId: meeting.id
  });
});

module.exports = router;
