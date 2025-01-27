

// ✅ Prevent EventEmitter memory leak warnings
const EventEmitter = require('events');
EventEmitter.defaultMaxListeners = 50;

// ✅ Imports
// import { Boom } from '@hapi/boom'
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, Browsers, makeInMemoryStore } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const express = require('express');
const bodyParser = require('body-parser');
const P = require('pino');
const NodeCache = require('node-cache');
const cors = require('cors');
const http = require('http');
const fs = require('fs');
const WebSocket = require('ws');
const axios = require('axios');
const path = require('path');

// ✅ Setup
const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
// const wss = new WebSocket.Server({
//   port: process.env.PORT || 3000, // Ensure this port matches the one set in cPanel
//   host: 'http://wa.coffeelabs.id', // Your domain
// });
// const io = new Server(server, {
//     cors: {
//         origin: 'http://localhost:5173',
//         methods: ['GET', 'POST'],
//     }
// });

// ✅ Middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));
// app.use(cors({
//   origin: 'http://wa.coffeelabs.id',
//   methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
//   allowedHeaders: ['Content-Type', 'Authorization'],
// }));
app.use(cors({
  origin: ['http://localhost:5173'], // Allow Vue local dev server
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));


const store = makeInMemoryStore({ logger: P({ level: 'silent' }) });

// ✅ Global State
let sock;
let connectedDevices = [];
let currentQR = null;

async function startWhatsApp() {
    const authFolder = './auth_info_baileys';

    if (!fs.existsSync(authFolder)) {
        try {
            fs.mkdirSync(authFolder);
            console.log('🛠️ Auth folder created successfully.');
        } catch (error) {
            console.error('❌ Failed to create auth folder:', error.message);
            return;
        }
    }

    const { state, saveCreds } = await useMultiFileAuthState(authFolder);

    try {
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: P({ level: 'info' }),
            browser: Browsers.ubuntu('Desktop'),
            keepAliveIntervalMs: 30_000,
            retryRequestDelayMs: 1000,
            maxMsgRetryCount: 5,
            emitOwnEvents: true,
            qrTimeout: 120_000,
            mediaCache: new NodeCache(),
            syncFullHistory: true,
            fireInitQueries: true,
            generateHighQualityLinkPreview: true,
            defaultQueryTimeoutMs: 60_000,
        });

        store.bind(sock.ev);
        sock.ev.on('creds.update', saveCreds);

        // ✅ Connection Event Handling
        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                currentQR = qr;
                QRCode.toDataURL(qr).then((qrDataUrl) => {
                    currentQR = qrDataUrl;
                    wss.clients.forEach(client => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify({ event: 'qr', data: qrDataUrl }));
                        }
                    });
                });
            } else {
                currentQR = null; // Reset QR when not available
            }



            if (connection === 'open') {
                console.log('✅ WhatsApp Connected');
                if (!connectedDevices.some(device => device.id === sock?.user?.id)) {
                    connectedDevices.push({
                        id: sock?.user?.id || `device_${Date.now()}`,
                        name: sock?.user?.name || 'Unknown Device'
                    });
                }
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        const timeout = setTimeout(() => {
                            client.terminate();
                            console.log('❌ Terminated slow WebSocket client.');
                        }, 5000); // Timeout in milliseconds

                        client.send(JSON.stringify({ event: 'status', data: { status: 'connected', devices: connectedDevices } }), () => {
                            clearTimeout(timeout); // Clear timeout on successful send
                        });
                    }
                });
            } else if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
                console.log('❌ Connection Closed. Reconnecting...');

                connectedDevices = connectedDevices.filter(device => device.id !== sock?.user?.id);
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        const timeout = setTimeout(() => {
                            client.terminate();
                            console.log('❌ Terminated slow WebSocket client.');
                        }, 5000); // Timeout in milliseconds

                        client.send(JSON.stringify({ event: 'status', data: { status: 'connected', devices: connectedDevices } }), () => {
                            clearTimeout(timeout); // Clear timeout on successful send
                        });
                    }
                });

                if (shouldReconnect) {
                    setTimeout(startWhatsApp, 5000); // Retry after 5 seconds
                } else {
                    console.log('🚫 Logged out. Manual intervention required.');
                }
            }

        });

        // ✅ Message Event Handling
        sock.ev.on('messages.upsert', async ({ messages }) => {
            const message = messages[0];
            console.log('📥 New Message Received:', message);

            if (message.key.fromMe) return;

            // await sock.sendMessage(message.key.remoteJid, { text: 'Auto-reply: Hello!' });
        });
    } catch (error) {
        console.error('❌ Failed to start WhatsApp connection:', error);
        setTimeout(startWhatsApp, 5000); // Retry after 5 seconds
    }
}


// ✅ Socket.IO Event Listeners
wss.on('connection', (ws) => {
    ws.isAlive = true;

    ws.on('pong', () => {
        ws.isAlive = true;
    });

    ws.send(JSON.stringify({
        event: 'status',
        data: { status: sock?.user ? 'connected' : 'disconnected', devices: connectedDevices }
    }));

    if (currentQR) {
        ws.send(JSON.stringify({ event: 'qr', data: currentQR }));
    }

    ws.on('close', () => console.log('❌ WebSocket client disconnected.'));
    ws.on('error', (err) => console.error('❌ WebSocket error:', err.message));
});

// Periodically check WebSocket health
setInterval(() => {
    wss.clients.forEach((client) => {
        if (!client.isAlive) {
            console.log('❌ Terminating stale WebSocket client.');
            return client.terminate();
        }
        client.isAlive = false;
        client.ping();
    });
}, 30000);

// QR Code Page
app.get('/', async (req, res) => {
  try {
    const response = await axios.get('http://localhost:3000/qr');
    res.render('qr', { qr: response.data.qr });
  } catch (error) {
    console.error('Failed to fetch QR Code:', error.message);
    res.render('qr', { qr: null });
  }
});

// Devices Page
app.get('/devices', async (req, res) => {
  try {
    const response = await axios.get('http://localhost:3000/devices');
    res.render('devices', { devices: response.data.devices });
  } catch (error) {
    console.error('Failed to fetch devices:', error.message);
    res.render('devices', { devices: [] });
  }
});


// Remove Device
app.post('/devices/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await axios.delete(`http://localhost:3000/devices/${id}`);
    res.redirect('/devices');
  } catch (error) {
    console.error('Failed to remove device:', error.message);
    res.redirect('/devices');
  }
});

// Status Page
app.get('/status', async (req, res) => {
  try {
    const response = await axios.get('http://localhost:3000/status');
    res.render('status', { status: response.data.message });
  } catch (error) {
    console.error('Failed to fetch status:', error.message);
    res.render('status', { status: 'Unknown' });
  }
});

// Send Notification Page
app.get('/send-notification', (req, res) => {
  res.render('send-notification');
});

// Send Notification
app.post('/send-notification', async (req, res) => {
  const { phoneNumber, message } = req.body;
  try {
    await axios.post('http://localhost:3000/send-notification', { phoneNumber, message });
    res.redirect('/send-notification');
  } catch (error) {
    console.error('Failed to send notification:', error.message);
    res.redirect('/send-notification');
  }
});




// ✅ API Endpoints
app.get('/devices', (req, res) => {
    res.json({ status: 'success', devices: connectedDevices });
});

app.delete('/devices/:id', (req, res) => {
    const { id } = req.params;
    connectedDevices = connectedDevices.filter(device => device.id !== id);
    // io.emit('status', { status: 'device_removed', devices: connectedDevices });
    res.json({ status: 'success', message: `Device ${id} removed` });
});

app.post('/send-notification', async (req, res) => {
    const { phoneNumber, message } = req.body;

    if (!sock?.user) {
        return res.status(500).json({ error: 'WhatsApp client is not initialized or disconnected' });
    }

    try {
        await sock.sendMessage(`${phoneNumber}@s.whatsapp.net`, { text: message });
        res.json({ status: 'success', message: 'Message sent successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to send message', details: error.message });
    }
});

app.get('/qr', (req, res) => {
    if (!currentQR) {
        return res.status(404).json({ status: 'error', message: 'QR code is not available' });
    }
    res.json({ status: 'success', qr: currentQR });
});


// ✅ Logout Endpoint
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




// ✅ Check WhatsApp Connection Status
app.get('/status', (req, res) => {
    if (!sock) {
        return res.status(500).json({ error: 'WhatsApp client is not initialized' });
    }

    const isConnected = sock?.user !== undefined;

    if (isConnected) {
        console.log('✅ WhatsApp is connected');
        res.json({ status: 'connected', message: 'WhatsApp is connected' });
    } else {
        console.log('❌ WhatsApp is disconnected');
        res.json({ status: 'disconnected', message: 'WhatsApp is disconnected' });
    }
});


// ✅ Graceful Shutdown
process.on('SIGINT', async () => {
    console.log('🛑 Server shutting down...');
    try {
        if (sock) {
            await sock.logout();
            sock.ev.removeAllListeners(); // Remove all event listeners
            sock = null;
        }
    } catch (error) {
        console.error('❌ Error during shutdown:', error.message);
    } finally {
        server.close(() => {
            console.log('✅ Server closed');
            process.exit(0);
        });
    }
});


// ✅ Start Server
// Start Server
const PORTS = 4000; // Frontend runs on a different PORTS
app.listen(PORTS, () => {
  console.log(`Frontend running at http://localhost:${PORTS}`);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
    await startWhatsApp();
});
