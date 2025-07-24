require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');
const https = require('https'); // ✅ For HTTPS

// Custom Configs
const sessionConfig = require('./config/session');
const pageRoutes = require('./routes/pages');
const apiRoutes = require('./routes/api');
const { setupWebSocket } = require('./services/websocketService');
const { startWhatsApp } = require('./services/whatsappService');

const app = express();

// ✅ HTTPS Credentials
const credentials = {
 key: fs.readFileSync('./privkey.pem'),
cert: fs.readFileSync('./cert.pem'),
ca: fs.readFileSync('./fullchain.pem'),
};

// ✅ Create HTTPS Server
const server = https.createServer(credentials, app);

// ✅ Express Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(cors());
app.use(session(sessionConfig));

// ✅ Routes
app.use(pageRoutes);
app.use(apiRoutes);

// ✅ WebSocket Setup
setupWebSocket(server);

// ✅ Start the server
const PORT = process.env.PORT || 8080;
server.listen(PORT, async () => {
  console.log(`🔐 HTTPS Server running at https://localhost:${PORT}`);
  await startWhatsApp();
});
