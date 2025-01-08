// ✅ Prevent EventEmitter memory leak warnings
const EventEmitter = require('events');
EventEmitter.defaultMaxListeners = 50;

// ✅ Imports
import { Boom } from '@hapi/boom'
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, Browsers, makeInMemoryStore } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const express = require('express');
const bodyParser = require('body-parser');
const P = require('pino');
const NodeCache = require('node-cache');
const cors = require('cors');
const { Server } = require('socket.io');
const http = require('http');
const fs = require('fs');

// ✅ Setup
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:5173',
        methods: ['GET', 'POST'],
    }
});

// ✅ Middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));
app.use(cors({
    origin: 'http://localhost:5173',
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
        console.log('🛠️ Auth folder missing. Creating a fresh session...');
        fs.mkdirSync(authFolder);
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
                sock.qr = qr;
                QRCode.toDataURL(qr).then((qrDataUrl) => {
                    io.emit('qr', qrDataUrl); // Emit QR Code in real-time
                });
            } else {
                sock.qr = null; // Clear QR when not available
            }

            if (connection === 'open') {
                console.log('✅ WhatsApp Connected');
                if (!connectedDevices.some(device => device.id === sock?.user?.id)) {
                    connectedDevices.push({
                        id: sock?.user?.id || `device_${Date.now()}`,
                        name: sock?.user?.name || 'Unknown Device'
                    });
                }
                io.emit('status', { status: 'connected', devices: connectedDevices });
            } else if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
                console.log('❌ Connection Closed. Reconnecting...', shouldReconnect);

                // Remove device on disconnect
                connectedDevices = connectedDevices.filter(device => device.id !== sock?.user?.id);
                io.emit('status', { status: 'disconnected', devices: connectedDevices });

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
io.on('connection', (socket) => {
    console.log('✅ A user connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('❌ User disconnected:', socket.id);
    });

    // Send Initial Status
    socket.emit('status', {
        status: sock?.user ? 'connected' : 'disconnected',
        devices: connectedDevices,
    });

    // Send Current QR Code
    if (currentQR) {
        QRCode.toDataURL(currentQR).then((qrDataUrl) => {
            socket.emit('qr', qrDataUrl);
        });
    }
});

// ✅ API Endpoints
app.get('/devices', (req, res) => {
    res.json({ status: 'success', devices: connectedDevices });
});

app.delete('/devices/:id', (req, res) => {
    const { id } = req.params;
    connectedDevices = connectedDevices.filter(device => device.id !== id);
    io.emit('status', { status: 'device_removed', devices: connectedDevices });
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

app.get('/qr', async (req, res) => {
    if (!currentQR) {
        return res.json({ status: 'pending', message: 'QR code is not available at the moment' });
    }

    try {
        const qrImage = await QRCode.toDataURL(currentQR);
        res.json({ status: 'qr', qr: qrImage });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate QR Code' });
    }
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

            connectedDevices = connectedDevices.filter(device => device.id !== sock?.user?.id);

            io.emit('status', { status: 'disconnected', devices: connectedDevices });

            await startWhatsApp();

            res.json({ status: 'success', message: 'Successfully logged out from WhatsApp and restarted connection.' });
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
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
    await startWhatsApp();
});
