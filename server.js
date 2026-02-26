require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(session({
    secret: 'ppt-builder-secret-key',
    resave: false,
    saveUninitialized: true
}));

// Make db accessible to routes
app.set('db', db);

// ─── View Engine ──────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ─── DB Pool ──────────────────────────────────────────────────────────────────
const db = mysql.createPool({
    host:     process.env.DB_HOST     || 'localhost',
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASS     || '',
    database: process.env.DB_NAME     || 'ppt_builder',
    waitForConnections: true,
    connectionLimit: 10
});

// ─── Upload Config ────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, 'uploads/images');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '_' + file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_'));
    }
});
const upload = multer({ storage });

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/', require('./routes/pages'));
app.use('/api', require('./routes/api')(db, upload));

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`✅ PPT Builder running at http://localhost:${PORT}`);
});
