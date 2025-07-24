const express = require('express');
const bcrypt = require('bcrypt');
const { getQR, getDevices, getSock, clearSession, startWhatsApp } = require('../services/whatsappService');
const { requireLogin } = require('../middlewares/authMiddleware');

const router = express.Router();

const users = [
  { id: 1, email: 'admin@whatsapp.com', password: bcrypt.hashSync('admin123', 10) },
];

router.get('/', requireLogin, (req, res) => res.redirect('/dashboard'));

router.get('/dashboard', requireLogin, (req, res) => {
  res.render('dashboard', {
    status: getSock()?.user ? 'Connected' : 'Disconnected',
    devices: getDevices(),
    qr: getQR()
  });
});

router.get('/login', (req, res) => res.render('login', { error: null }));

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);
  if (user && bcrypt.compareSync(password, user.password)) {
    req.session.userId = user.id;
    return res.redirect('/dashboard');
  }
  res.render('login', { error: 'Invalid credentials' });
});

router.post('/logout-user', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

router.post('/logout', async (req, res) => {
  try {
    if (getSock()?.ws?.readyState === 1) {
      await getSock().logout();
    }
    clearSession();
    await startWhatsApp();
    res.json({ status: 'success', message: 'Logged out and restarted WhatsApp connection.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
