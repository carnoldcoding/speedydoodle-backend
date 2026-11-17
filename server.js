require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const ImageKit = require('imagekit');
const nodemailer = require('nodemailer');
const { openDatabase } = require('./src/db');
const { createMaps } = require('./src/maps');
const { createApp } = require('./src/app');

const PORT = process.env.PORT || 5000;
// The address to listen on. The default accepts connections from this machine
// only. On the apps machine, HOST is the address that nginx forwards to.
const HOST = process.env.HOST || '127.0.0.1';
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'speedydoodle.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = openDatabase(DB_PATH);

const imagekit = new ImageKit({
  publicKey: process.env.PUBLIC_KEY,
  privateKey: process.env.PRIVATE_KEY,
  urlEndpoint: process.env.URL_ENDPOINT,
});

// Mailgun, through the Simple Mail Transfer Protocol (SMTP).
const mailer = nodemailer.createTransport({
  host: 'smtp.mailgun.org',
  port: 587,
  secure: false,
  auth: {
    user: process.env.MAILGUN_SMTP_USERNAME,
    pass: process.env.MAILGUN_SMTP_PASSWORD,
  },
});

const app = createApp({
  db,
  mailer,
  maps: createMaps({ apiKey: process.env.MAPS_API_KEY }),
  imagekit,
  sender: process.env.MAIL_FROM || 'noreply@mail.speedydoodle.com',
  trustProxy: process.env.TRUST_PROXY,
});

app.listen(PORT, HOST, () => {
  console.log(`Server is running on ${HOST}:${PORT}`);
});
