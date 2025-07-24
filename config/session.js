const session = require('express-session');


module.exports = {
  secret: 'supersecret', // 🔒 set in .env in production
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // make sure HTTPS is being used
  }
};
