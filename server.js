require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');

const sessionConfig = require('./config/session');
const pageRoutes = require('./routes/pages');
const apiRoutes = require('./routes/api');
const { setupWebSocket } = require('./services/websocketService');
const { startWhatsApp, getSock } = require('./services/whatsappService');

const app = express();
const server = http.createServer(app);

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(cors());
app.use(session(sessionConfig));

// Routes
app.use(pageRoutes);
app.use(apiRoutes);

// WebSocket
setupWebSocket(server);

// Start
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  await startWhatsApp();
});
