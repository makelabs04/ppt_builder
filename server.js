const express = require('express');
const mysql = require('mysql2/promise');
const session = require('express-session');
const path = require('path');
const upload = require('./middlewares/upload');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Read DB env vars from hPanel Environment Variables (no dotenv needed in production)
const {
 DB_HOST,
 DB_USER,
 DB_PASS,
 DB_NAME,
} = process.env;

if (!DB_HOST || !DB_USER || !DB_PASS || !DB_NAME) {
 console.error('Missing DB env vars. Check hPanel Node.js → Environment variables.');
 console.error('DB_HOST:', DB_HOST);
 console.error('DB_USER:', DB_USER);
 console.error('DB_NAME:', DB_NAME);
}

const db = mysql.createPool({
 host: DB_HOST || '127.0.0.1',
 user: DB_USER || '',
 password: DB_PASS || '',
 database: DB_NAME || '',
 waitForConnections: true,
 connectionLimit: 10,
});

app.set('db', db);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
 session({
 secret: process.env.SESSION_SECRET || 'ppt-builder-secret-key',
 resave: false,
 saveUninitialized: false,
 })
);

app.use('/', require('./routes/pages'));
app.use('/api', require('./routes/api')(db, upload));

app.listen(PORT, '0.0.0.0', () => {
 console.log(`Server running on port ${PORT}`);
});
