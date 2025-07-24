const WebSocket = require('ws');
const { getQR, getDevices, getSock } = require('./whatsappService');

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => (ws.isAlive = true));
    ws.send(JSON.stringify({
      event: 'status',
      data: {
        status: getSock()?.user ? 'connected' : 'disconnected',
        devices: getDevices(),
      },
    }));
    if (getQR()) ws.send(JSON.stringify({ event: 'qr', data: getQR() }));
  });

  setInterval(() => {
    wss.clients.forEach((client) => {
      if (!client.isAlive) return client.terminate();
      client.isAlive = false;
      client.ping();
    });
  }, 30000);
}

module.exports = { setupWebSocket };
