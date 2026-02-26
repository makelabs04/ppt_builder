const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

// We need the db pool – it's attached to app.locals in server.js
// So we export a factory that receives db
// But for simplicity we use a lazy require approach via req.app

// ─── Home: list all presentations ────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const db = req.app.locals.db || require('../server').db;
        // db is not exported from server.js, so we re-init pool here
        // Better: pass db via middleware (see server.js update note)
        const pool = getPool(req);
        const [rows] = await pool.query(
            'SELECT id, title, description, created_at, updated_at, status FROM presentations ORDER BY updated_at DESC'
        );
        res.render('index', { presentations: rows });
    } catch (err) {
        console.error(err);
        res.status(500).send('Database error: ' + err.message);
    }
});

// ─── Editor: new or edit ──────────────────────────────────────────────────────
router.get('/editor', async (req, res) => {
    const id = req.query.id || null;
    let presentation = { id: '', title: '', description: '', slides: [] };

    if (id) {
        try {
            const pool = getPool(req);
            const [pres] = await pool.query('SELECT * FROM presentations WHERE id = ?', [id]);
            if (pres.length > 0) {
                presentation = pres[0];
                const [slides] = await pool.query(
                    'SELECT * FROM slides WHERE presentation_id = ? ORDER BY slide_number',
                    [id]
                );
                presentation.slides = slides.map(s => ({
                    title:         s.title         || '',
                    content:       s.content       || '',
                    contentType:   s.content_type  || 'paragraph',
                    imagePath:     s.image_path    || '',
                    imagePosition: s.image_position || 'right',
                    imageLeft:     s.image_left    || 0,
                    imageTop:      s.image_top     || 0,
                    imageWidth:    s.image_width   || 300,
                    imageHeight:   s.image_height  || 300
                }));
            }
        } catch (err) {
            console.error(err);
        }
    }

    if (!presentation.slides || presentation.slides.length === 0) {
        presentation.slides = [{
            title: '', content: '', contentType: 'paragraph',
            imagePath: '', imagePosition: 'right',
            imageLeft: 0, imageTop: 0, imageWidth: 300, imageHeight: 300
        }];
    }

    res.render('editor', { presentation });
});

// ─── View presentation ────────────────────────────────────────────────────────
router.get('/view', async (req, res) => {
    const id = req.query.id;
    if (!id) return res.redirect('/');

    try {
        const pool = getPool(req);
        const [pres] = await pool.query('SELECT * FROM presentations WHERE id = ?', [id]);
        if (pres.length === 0) return res.redirect('/');

        const [slides] = await pool.query(
            'SELECT * FROM slides WHERE presentation_id = ? ORDER BY slide_number',
            [id]
        );
        res.render('view', { presentation: pres[0], slides });
    } catch (err) {
        console.error(err);
        res.status(500).send('Database error');
    }
});

// ─── Helper: get pool from req.app ───────────────────────────────────────────
function getPool(req) {
    return req.app.get('db');
}

module.exports = router;
