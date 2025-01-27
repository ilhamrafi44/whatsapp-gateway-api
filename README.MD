WhatsApp Management Dashboard
A comprehensive WhatsApp management tool for real-time monitoring, message sending, and session control. Built with **Node.js**, **Express.js**, **WebSocket**, and **Baileys**, this application offers features such as QR code generation, device management, server monitoring, and authentication.
Project Details
- **Author**: [Muhammad Ilham Rafiannandha](https://linkedin.com/in/ilhamrafi44)
- **Status**: First stable release (ongoing development)
- **Purpose**: To provide a user-friendly dashboard for managing WhatsApp connections and automating basic WhatsApp messaging tasks.
Features
1. Real-Time Dashboard:
- Live updates using WebSocket.
- QR code generation for WhatsApp authentication.
1. Device Management:
- Add/remove connected devices.
- View live session details.
1. Message Automation:
- Send WhatsApp messages directly from the dashboard.
- Simple UI for sending notifications.
1. Server Monitoring:
- View uptime, load averages, memory usage, and WebSocket connections.
- Real-time server logs.
Built With
Node.js - Backend framework.
Express.js - For routing and API handling.
WebSocket - Real-time updates.
Baileys - WhatsApp Web API.
EJS - Template rendering for views.
SweetAlert2 - Beautiful alert messages.
Bootstrap 5 - Responsive frontend design.
Getting Started
Follow these instructions to set up and run the project locally, on shared hosting, or a VPS.
Prerequisites
- Node.js (v16 or higher)
- npm (Node Package Manager)
- A WhatsApp account for testing
- An Ubuntu-based VPS or shared hosting environment if deploying.
Installation
1. Clone the repository: `git clone <repository_url>`
2. Navigate to the project directory: `cd whatsapp-dashboard`
3. Install dependencies: `npm install`
4. Start the application: `node server.js`
5. Access the dashboard at `http://localhost:3000`.
Deployment
### On VPS or Dedicated Server:
1. Install Node.js and npm.
2. Clone the repository and install dependencies.
3. Use a process manager like PM2 to keep the app running.
4. Configure your domain and reverse proxy using NGINX or Apache.
5. Secure the app with SSL/TLS certificates (e.g., Let's Encrypt).
### On Shared Hosting:
Shared hosting may not directly support Node.js. Use services like cPanel with Node.js support or switch to VPS.
Usage
Once deployed, login using the provided credentials (`admin@whatsapp.com` / `admin123`). Navigate through the dashboard to manage connected devices, send messages, and monitor server status.
License
This project is licensed under the MIT License.
