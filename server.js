// ✅ Prevent EventEmitter memory leak warnings
const EventEmitter = require('events');
EventEmitter.defaultMaxListeners = 50;

// ✅ Imports
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const QRCode = require('qrcode');
const P = require('pino');
const axios = require('axios');
const { makeWASocket, useMultiFileAuthState, Browsers, makeInMemoryStore } = require('@whiskeysockets/baileys');
const session = require('express-session');
const bcrypt = require('bcrypt');
const os = require('os');

// ✅ Setup
const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({ limit: '10mb' }));

// ✅ Session Middleware
app.use(
  session({
    secret: 'your-secret-key', // Replace with a strong secret in production
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Set `secure: true` if using HTTPS
  })
);

// ✅ Dummy User for Authentication
const users = [
  {
    id: 1,
    email: 'admin@whatsapp.com',
    password: bcrypt.hashSync('admin123', 10), // Replace with a stronger password
  },
];

// ✅ Middleware to Protect Routes
function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  next();
}


// ✅ CORS Configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ✅ Global State
const authFolder = path.join(__dirname, 'auth_info_baileys');
const store = makeInMemoryStore({ logger: P({ level: 'silent' }) });
let sock;
let connectedDevices = [];
let currentQR = null;

// ✅ Initialize WhatsApp Connection
async function startWhatsApp() {
  if (!fs.existsSync(authFolder)) {
    fs.mkdirSync(authFolder);
    console.log('🛠️ Auth folder created successfully.');
  }

  const { state, saveCreds } = await useMultiFileAuthState(authFolder);

  try {
    sock = makeWASocket({
      auth: state,
      browser: Browsers.ubuntu('Desktop'),
      logger: P({ level: 'info' }),
      syncFullHistory: true,
    });

    store.bind(sock.ev);
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        QRCode.toDataURL(qr).then((qrDataUrl) => {
          currentQR = qrDataUrl;
          broadcastWebSocket({ event: 'qr', data: qrDataUrl });
        });
      } else {
        currentQR = null;
      }

      if (connection === 'open') {
        console.log('✅ WhatsApp Connected');
        connectedDevices = [{ id: sock.user?.id, name: sock.user?.name || 'Unknown Device' }];
        broadcastWebSocket({ event: 'status', data: { status: 'connected', devices: connectedDevices } });
      } else if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== 401) {
        console.log('❌ Connection closed. Reconnecting...');
        setTimeout(startWhatsApp, 5000);
      }
    });

    sock.ev.on('messages.upsert', ({ messages }) => {
      const [message] = messages;
      if (!message.key.fromMe) {
        console.log('📥 New Message:', message);
      }
    });
  } catch (error) {
    console.error('❌ Failed to initialize WhatsApp:', error.message);
    setTimeout(startWhatsApp, 5000);
  }
}

// ✅ Broadcast WebSocket Message
function broadcastWebSocket(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// ✅ WebSocket Health Check
setInterval(() => {
  wss.clients.forEach((client) => {
    if (!client.isAlive) return client.terminate();
    client.isAlive = false;
    client.ping();
  });
}, 30000);

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));
  ws.send(JSON.stringify({ event: 'status', data: { status: sock?.user ? 'connected' : 'disconnected', devices: connectedDevices } }));
  if (currentQR) ws.send(JSON.stringify({ event: 'qr', data: currentQR }));
});

// ✅ EJS Frontend Routes
app.get('/', requireLogin, (req, res) => res.render('qr', { qr: currentQR }));
app.get('/devices', requireLogin, (req, res) => res.render('devices', { devices: connectedDevices }));
app.get('/status', requireLogin, (req, res) => res.render('status', { status: sock?.user ? 'Connected' : 'Disconnected' }));
app.get('/send-notification', requireLogin, (req, res) => res.render('send-notification'));

// ✅ Login Page
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.get('/docs', (req, res) => {
  res.render('docs', { error: null });
});

// ✅ Dashboard Route
app.get('/dashboard', requireLogin, (req, res) => {
  res.render('dashboard', {
    status: sock?.user ? 'Connected' : 'Disconnected',
    devices: connectedDevices,
    qr: currentQR // Pass the QR code to the EJS template
  });
});


// ✅ Backend API Endpoints
app.get('/qr', (req, res) => currentQR ? res.json({ qr: currentQR }) : res.status(404).json({ message: 'QR code not available' }));
app.get('/devices', (req, res) => res.json({ devices: connectedDevices }));
app.delete('/devices/:id', (req, res) => {
  connectedDevices = connectedDevices.filter(device => device.id !== req.params.id);
  res.json({ message: 'Device removed' });
});

// ✅ Send Notification
app.post('/send-notification', async (req, res) => {
  const { phoneNumber, message } = req.body;
  try {
    await sock.sendMessage(`${phoneNumber}@s.whatsapp.net`, { text: message });
    res.json({ message: 'Message sent successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send message', details: error.message });
  }
});

// ✅ Login Submission
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.find((u) => u.email === email);

  if (user && bcrypt.compareSync(password, user.password)) {
    req.session.userId = user.id; // Save user ID in session
    return res.redirect('/dashboard');
  }

  res.render('login', { error: 'Invalid email or password' });
});

// ✅ Logout User
app.post('/logout-user', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// ✅ Logout Whatsapp Endpoint
app.post('/logout', async (req, res) => {
    try {
        if (sock) {
            console.log('🔒 Logging out from WhatsApp...');

            if (sock.ws?.readyState === 1) {
                await sock.logout();
            }

            fs.rmSync('./auth_info_baileys', { recursive: true, force: true });
            console.log('🗑️ Auth folder cleared.');

            connectedDevices = [];
            currentQR = null;

            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        event: 'status',
                        data: { status: 'disconnected', devices: connectedDevices }
                    }));
                }
            });

            await startWhatsApp();

            res.json({ status: 'success', message: 'Successfully logged out and restarted WhatsApp connection.' });
        } else {
            res.status(500).json({ error: 'WhatsApp client is not initialized' });
        }
    } catch (error) {
        console.error('❌ Failed to logout:', error);
        res.status(500).json({ error: 'Failed to logout from WhatsApp', details: error.message });
    }
});

// Endpoint to fetch server status
app.get('/api/server-status', requireLogin, (req, res) => {
    const uptime = os.uptime(); // Server uptime
    const load = os.loadavg(); // Load average
    const memoryUsage = process.memoryUsage();
    const connections = wss.clients.size; // Active WebSocket connections

    res.json({
        uptime,
        load,
        memoryUsage,
        connections,
        status: sock?.user ? 'Connected' : 'Disconnected',
    });
});

// Endpoint to fetch logs
app.get('/api/server-logs', requireLogin, (req, res) => {
    fs.readFile('./logs/server.log', 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Failed to read logs' });
        res.json({ logs: data.split('\n') });
    });
});

// ✅ Graceful Shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down...');
//   if (sock) await sock.logout();
  server.close(() => process.exit(0));
});

// ✅ Start Server
server.listen(3000, async () => {
  console.log('🚀 Server running on http://localhost:3000');
  await startWhatsApp();
});
