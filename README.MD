WhatsApp Management Dashboard
Project by Muhammad Ilham Rafiannandha
LinkedIn: https://linkedin.com/in/ilhamrafi44
Overview
The WhatsApp Management Dashboard is a web-based platform that provides a comprehensive way to manage WhatsApp instances, connected devices, send notifications, and monitor server logs and status in real-time.
This is the first stable release, and the project is still ongoing. Contributions and forks are welcome!
Features
- QR Code Scanning: Generate and refresh QR codes for WhatsApp connections.
- Device Management: View and remove connected devices.
- Notifications: Send text notifications via WhatsApp to any number.
- Real-Time Status: Monitor server uptime, WebSocket connections, and memory usage.
- Logs Management: Fetch and view server logs dynamically.
- Authentication: Secure login with session-based management.
Built With
- Node.js: Backend server environment.
- Express.js: Web framework for building the server.
- EJS: Embedded JavaScript templates for dynamic rendering.
- Bootstrap: Frontend styling for a responsive and professional look.
- Baileys: WhatsApp Web API library.
- SweetAlert2: For interactive modals and alerts.
- WebSocket: Real-time communication with the dashboard.
- Pino: Lightweight logger for Node.js.
- bcrypt: Password hashing for secure authentication.
Requirements
- Node.js: v16+
- npm: v7+
- A VPS or Shared Hosting Environment
Installation
Clone this repository:

   ```bash
   git clone https://github.com/ilhamrafi44/whatsapp-management-dashboard.git
   cd whatsapp-management-dashboard
   ```
Install dependencies:

   ```bash
   npm install
   ```
Create a `.env` file and configure the following:

   ```env
   PORT=3000
   SESSION_SECRET=your-secret-key
   ```
Start the server:

   ```bash
   npm start
   ```
Access the dashboard:

   Open `http://localhost:3000` in your browser.
Deployment
Local Deployment
- Follow the installation steps above.
- Use a tool like **ngrok** to expose your local server publicly for testing.
VPS Deployment
Install Node.js and npm on your VPS.
Clone the repository and follow the installation steps.
Use **PM2** to keep the server running:

   ```bash
   npm install -g pm2
   pm2 start server.js --name whatsapp-dashboard
   pm2 save
   ```
Set up NGINX as a reverse proxy for better performance and HTTPS.
Shared Hosting
If your hosting supports Node.js applications, upload the project directory and configure the `PORT` and session secret.
API Endpoints
Authentication
- POST /login: Log in with email and password.
- POST /logout-user: Log out the user.
Dashboard
- GET /dashboard: Access the main dashboard.
- GET /qr: Fetch the current QR code.
Notifications
- POST /send-notification: Send a WhatsApp notification.
Logs & Status
- GET /api/server-status: Fetch server uptime, memory usage, and WebSocket connections.
- GET /api/server-logs: Fetch recent server logs.
Contributing
Contributions are welcome! Feel free to fork this repository and create pull requests.
License
This project is licensed under the MIT License.
Contact
For inquiries or support, connect with me on [LinkedIn](https://linkedin.com/in/ilhamrafi44).
