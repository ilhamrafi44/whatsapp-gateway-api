const fs = require('fs');
const path = require('path');
const { makeWASocket, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const P = require('pino');

const authFolder = path.join(__dirname, '..', 'auth_info_baileys');
let sock = null;
let currentQR = null;
let connectedDevices = [];

async function startWhatsApp() {
  if (!fs.existsSync(authFolder)) fs.mkdirSync(authFolder);

  const { state, saveCreds } = await useMultiFileAuthState(authFolder);

  sock = makeWASocket({
    auth: state,
    browser: Browsers.ubuntu('Desktop'),
    logger: P({ level: 'info' }),
    syncFullHistory: true,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      currentQR = await QRCode.toDataURL(qr);
    } else {
      currentQR = null;
    }

    if (connection === 'open') {
      connectedDevices = [{ id: sock.user?.id, name: sock.user?.name || 'Unknown Device' }];
    } else if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== 401) {
      setTimeout(startWhatsApp, 5000);
    }
  });

  sock.ev.on('messages.upsert', ({ messages }) => {
    const [message] = messages;
    if (!message.key.fromMe) {
      console.log('📥 New Message:', message);
    }
  });
}

module.exports = {
  startWhatsApp,
  getSock: () => sock,
  getQR: () => currentQR,
  getDevices: () => connectedDevices,
  clearSession: () => fs.rmSync(authFolder, { recursive: true, force: true })
};
