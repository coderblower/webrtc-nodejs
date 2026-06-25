const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { run, get } = require('../utils/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Doctor creates a scheduled meeting
router.post('/create', authMiddleware, async (req, res) => {
  const { doctorId, startDate, expireDate, customCode } = req.body;
  const meetingId = uuidv4();
  const joinCode = customCode || Math.floor(100000 + Math.random() * 900000).toString();
  const actualDoctorId = doctorId || (req.user ? req.user.id : null);
  const createdAt = new Date().toISOString();
  const sDate = startDate ? new Date(startDate).toISOString() : new Date().toISOString();
  const eDate = expireDate ? new Date(expireDate).toISOString() : null;
  const status = 'waiting';

  try {
    await run(`INSERT INTO meetings (id, joinCode, doctorId, patientId, createdAt, startDate, expireDate, status) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
               [meetingId, joinCode, actualDoctorId, null, createdAt, sDate, eDate, status]);
    
    res.json({
      success: true,
      meetingId,
      joinCode,
      startDate: sDate,
      expireDate: eDate
    });
  } catch (err) {
    console.error("Failed to create meeting in DB:", err);
    res.status(500).json({ error: 'Failed to create meeting' });
  }
});

// Validate meeting exists before joining
router.get('/:idOrCode', async (req, res) => {
  const { idOrCode } = req.params;
  
  try {
    const meeting = await get('SELECT * FROM meetings WHERE id = ? OR joinCode = ?', [idOrCode, idOrCode]);
    
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (meeting.status === 'ended') return res.status(400).json({ error: 'Meeting has ended' });

    const now = new Date();
    if (meeting.startDate && now < new Date(meeting.startDate)) {
      return res.status(400).json({ error: 'Schedule yet to come' });
    }
    if (meeting.expireDate && now > new Date(meeting.expireDate)) {
      return res.status(400).json({ error: 'Schedule has expired' });
    }

    res.json({
      success: true,
      meetingId: meeting.id,
      status: meeting.status
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Patient joins (REST part, real join is via Socket)
router.post('/join', async (req, res) => {
  const { joinCode } = req.body;
  
  try {
    const meeting = await get('SELECT * FROM meetings WHERE joinCode = ?', [joinCode]);
    
    if (!meeting) return res.status(404).json({ error: 'Invalid meeting code' });
    if (meeting.status === 'ended') return res.status(400).json({ error: 'Meeting has ended' });

    const now = new Date();
    if (meeting.startDate && now < new Date(meeting.startDate)) {
      return res.status(400).json({ error: 'Schedule yet to come' });
    }
    if (meeting.expireDate && now > new Date(meeting.expireDate)) {
      return res.status(400).json({ error: 'Schedule has expired' });
    }
    
    res.json({
      success: true,
      meetingId: meeting.id
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
