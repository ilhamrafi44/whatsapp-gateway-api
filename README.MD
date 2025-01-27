## WhatsApp Management Dashboard
A comprehensive application designed to manage WhatsApp connections, send notifications, and monitor server activities. This project is built with Node.js, Express, and Baileys library for WhatsApp Web API integration.

## Documentation
[Documentation](https://github.com/ilhamrafi44/whatsapp-gateway-api)

## Badges
[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![GPLv3 License](https://img.shields.io/badge/License-GPL%20v3-yellow.svg)](https://opensource.org/licenses/)
[![AGPL License](https://img.shields.io/badge/license-AGPL-blue.svg)](http://www.gnu.org/licenses/agpl-3.0)

## Authors
Project by [Muhammad Ilham Rafiannandha](https://linkedin.com/in/ilhamrafi44).

## Appendix
This project is under active development, and contributions are welcome.

## Installation
1. Clone the repository:
```bash
git clone https://github.com/ilhamrafi44/whatsapp-gateway-api
```
2. Navigate to the project directory:
```bash
cd whatsapp-gateway-api
```
3. Install dependencies:
```bash
npm install
```
4. Start the server:
```bash
node server.js
```
## Deployment
### Local Environment:
1. Ensure Node.js and npm are installed.
2. Follow the installation steps above.

### VPS Deployment:
1. Set up a VPS with Node.js.
2. Clone the repository to the server.
3. Install dependencies and configure the environment.
4. Use a process manager like PM2 for server stability:
```bash
pm2 start server.js
```

### Shared Hosting:
1. Use a hosting provider that supports Node.js.
2. Upload the project and configure the environment variables.
3. Start the server.

## API Reference
#### Get QR Code:
```http
GET /qr
```
Response:
```json
{ "qr": "<QR Code URL>" }
```
#### Send Notification:
```http
POST /send-notification
```
Body:
```json
{ "phoneNumber": "<number>", "message": "<message>" }
```
## Acknowledgements
Special thanks to:
- [Baileys Library](https://github.com/WhiskeySockets/Baileys)

## FAQ
### What is this project for?
This project manages WhatsApp connections and notifications.

### Can I contribute?
Yes, contributions are welcome. Fork the repository and submit a pull request.
