// ✅ Prevent EventEmitter memory leak warnings
const EventEmitter = require('events');
EventEmitter.defaultMaxListeners = 50;

// ✅ Imports
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const QRCode = require('qrcode');
const session = require('express-session');
const bcrypt = require('bcrypt');
const os = require('os');
const { Client, LocalAuth } = require('whatsapp-web.js');

// ✅ Setup Express
const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(cors());
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: true },
}));

// ✅ HTTPS Credentials
// const credentials = {
//   key: fs.readFileSync(path.join(__dirname, 'privkey.pem')),
//   cert: fs.readFileSync(path.join(__dirname, 'cert.pem')),
//   ca: fs.readFileSync(path.join(__dirname, 'fullchain.pem')),
// };

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ✅ Dummy User
const users = [{
  id: 1,
  email: 'admin@whatsapp.com',
  password: bcrypt.hashSync('admin123', 10),
}];

function requireLogin(req, res, next) {
  if (!req.session.userId) return res.redirect('/login');
  next();
}

// ✅ Global State
let client;
let connectedDevices = [];
let currentQR = null;

// ✅ WebSocket Broadcast
function broadcast(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// ✅ WhatsApp Initialization
function startWhatsApp() {
  client = new Client({ puppeteer: { headless: true,args: ['--no-sandbox', '--disable-setuid-sandbox']}, authStrategy: new LocalAuth() });

  client.on('qr', async (qr) => {
    currentQR = await QRCode.toDataURL(qr);
    broadcast({ event: 'qr', data: currentQR });
  });

  client.on('ready', () => {
    console.log('✅ WhatsApp Ready');
    connectedDevices = [{ id: client.info.wid._serialized, name: 'Local Device' }];
    broadcast({ event: 'status', data: { status: 'connected', devices: connectedDevices } });
  });

  client.on('disconnected', () => {
    console.log('❌ WhatsApp Disconnected');
    connectedDevices = [];
    currentQR = null;
    broadcast({ event: 'status', data: { status: 'disconnected', devices: [] } });
    startWhatsApp();
  });

  client.initialize();
}

// ✅ WebSocket Setup
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ event: 'status', data: { status: client?.info ? 'connected' : 'disconnected', devices: connectedDevices } }));
  if (currentQR) ws.send(JSON.stringify({ event: 'qr', data: currentQR }));
});

setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

// ✅ Routes
app.get('/', requireLogin, (req, res) => res.render('qr', { qr: currentQR }));
app.get('/dashboard', requireLogin, (req, res) => res.render('dashboard', {
  status: client?.info ? 'Connected' : 'Disconnected',
  devices: connectedDevices,
  qr: currentQR,
}));
app.get('/login', (req, res) => res.render('login', { error: null }));
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);
  if (user && bcrypt.compareSync(password, user.password)) {
    req.session.userId = user.id;
    return res.redirect('/dashboard');
  }
  res.render('login', { error: 'Invalid email or password' });
});

app.post('/logout-user', (req, res) => req.session.destroy(() => res.redirect('/login')));
app.post('/logout', async (req, res) => {
  try {
    if (client) {
      await client.destroy();
      currentQR = null;
      connectedDevices = [];
      broadcast({ event: 'status', data: { status: 'disconnected', devices: [] } });
      startWhatsApp();
      res.json({ status: 'success', message: 'WhatsApp restarted' });
    } else {
      res.status(500).json({ error: 'Client not initialized' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Logout failed', details: err.message });
  }
});

app.post('/send-notification', async (req, res) => {
  const { phoneNumber, message } = req.body;
  try {
    await client.sendMessage(`${phoneNumber}@c.us`, message);
    res.json({ message: 'Message sent' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send', details: err.message });
  }
});

// ✅ Endpoint to fetch server status
app.get('/api/server-status', requireLogin, (req, res) => {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    const connections = wss.clients.size;

    res.json({
        uptime,
        memoryUsage,
        connections,
        status: client?.info?.wid ? 'Connected' : 'Disconnected',
    });
});

app.get('/docs', (req, res) => {
  res.render('docs', { error: null });
});

// ✅ Endpoint to fetch logs
app.get('/api/server-logs', requireLogin, (req, res) => {
    fs.readFile('./logs/server.log', 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Failed to read logs' });
        res.json({ logs: data.split('\n') });
    });
});


// ✅ Start Server
server.listen(8080, () => {
  console.log('🚀 HTTPS Server running on http://localhost:8080');
  startWhatsApp();
});
