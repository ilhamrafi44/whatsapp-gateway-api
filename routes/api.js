const express = require('express');
const os = require('os');
const fs = require('fs');
const { getQR, getDevices, getSock } = require('../services/whatsappService');
const { requireLogin } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/qr', (req, res) => {
  const qr = getQR();
  qr ? res.json({ qr }) : res.status(404).json({ message: 'QR not available' });
});

router.get('/devices', (req, res) => res.json({ devices: getDevices() }));

router.post('/send-notification', async (req, res) => {
  const { phoneNumber, message } = req.body;
  try {
    await getSock().sendMessage(`${phoneNumber}@s.whatsapp.net`, { text: message });
    res.json({ message: 'Message sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/server-status', requireLogin, (req, res) => {
  res.json({
    uptime: os.uptime(),
    load: os.loadavg(),
    memoryUsage: process.memoryUsage(),
    connections: getSock()?.ws ? 1 : 0,
    status: getSock()?.user ? 'Connected' : 'Disconnected',
  });
});

router.get('/api/server-logs', requireLogin, (req, res) => {
  fs.readFile('./logs/server.log', 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Failed to read logs' });
    res.json({ logs: data.split('\n') });
  });
});

module.exports = router;
