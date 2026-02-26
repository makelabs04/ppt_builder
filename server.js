require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const session = require('express-session');
const path = require('path');

const app = express();

const PORT = process.env.PORT; // IMPORTANT

/* DATABASE */
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
});

app.set('db', db);

/* MIDDLEWARE */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'ppt-builder-secret-key',
    resave: false,
    saveUninitialized: false
}));
/* ROUTES */
app.use('/', require('./routes/pages'));
app.use('/api', require('./routes/api')(db));

/* START SERVER */
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
