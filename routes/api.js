const express = require('express');
const fs = require('fs');
const path = require('path');
const { generatePPTX } = require('../lib/pptx_generator');

module.exports = function (db, upload) {
    const router = express.Router();

    // ── Upload image ─────────────────────────────────────────────────────────
    router.post('/upload_image', upload.single('image'), (req, res) => {
        if (!req.file) {
            return res.json({ success: false, message: 'No image provided' });
        }
        const filePath = 'uploads/images/' + req.file.filename;
        res.json({ success: true, file_path: filePath, file_name: req.file.filename });
    });

    // ── Save presentation ────────────────────────────────────────────────────
    router.post('/save_presentation', async (req, res) => {
        const data = req.body;

        if (!data.title || !data.title.trim()) {
            return res.json({ success: false, message: 'Title is required' });
        }

        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();

            let presentationId;

            if (!data.id || data.id === '') {
                const [result] = await conn.execute(
                    'INSERT INTO presentations (title, description) VALUES (?, ?)',
                    [data.title, data.description || '']
                );
                presentationId = result.insertId;
            } else {
                presentationId = parseInt(data.id);
                await conn.execute(
                    'UPDATE presentations SET title = ?, description = ?, updated_at = NOW() WHERE id = ?',
                    [data.title, data.description || '', presentationId]
                );
            }

            // Delete existing slides
            await conn.execute('DELETE FROM slides WHERE presentation_id = ?', [presentationId]);

            // Insert new slides
            if (Array.isArray(data.slides)) {
                for (let i = 0; i < data.slides.length; i++) {
                    const s = data.slides[i];
                    await conn.execute(
                        `INSERT INTO slides 
                        (presentation_id, slide_number, title, content, content_type, image_path, image_position, image_left, image_top, image_width, image_height)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            presentationId,
                            i + 1,
                            s.title         || '',
                            s.content       || '',
                            s.contentType   || 'paragraph',
                            s.imagePath     || '',
                            s.imagePosition || 'right',
                            parseInt(s.imageLeft)   || 0,
                            parseInt(s.imageTop)    || 0,
                            parseInt(s.imageWidth)  || 300,
                            parseInt(s.imageHeight) || 300
                        ]
                    );
                }
            }

            await conn.commit();
            res.json({ success: true, presentation_id: presentationId, message: 'Saved successfully' });
        } catch (err) {
            await conn.rollback();
            console.error(err);
            res.json({ success: false, message: 'Save failed: ' + err.message });
        } finally {
            conn.release();
        }
    });

    // ── Get single presentation ──────────────────────────────────────────────
    router.get('/get_presentation', async (req, res) => {
        const id = req.query.id;
        try {
            const [pres] = await db.execute('SELECT * FROM presentations WHERE id = ?', [id]);
            if (pres.length === 0) return res.json({ success: false, message: 'Not found' });

            const [slides] = await db.execute(
                'SELECT * FROM slides WHERE presentation_id = ? ORDER BY slide_number',
                [id]
            );
            pres[0].slides = slides;
            res.json({ success: true, data: pres[0] });
        } catch (err) {
            res.json({ success: false, message: err.message });
        }
    });

    // ── Get all presentations ────────────────────────────────────────────────
    router.get('/get_presentations', async (req, res) => {
        try {
            const [rows] = await db.execute(
                'SELECT id, title, description, created_at, updated_at FROM presentations ORDER BY updated_at DESC'
            );
            res.json({ success: true, data: rows });
        } catch (err) {
            res.json({ success: false, message: err.message });
        }
    });

    // ── Delete presentation ──────────────────────────────────────────────────
    router.post('/delete_presentation', async (req, res) => {
        const id = parseInt(req.body.id);
        try {
            // Get image paths before deleting
            const [slides] = await db.execute(
                'SELECT image_path FROM slides WHERE presentation_id = ?',
                [id]
            );
            slides.forEach(s => {
                if (s.image_path) {
                    const absPath = path.join(__dirname, '..', s.image_path);
                    if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
                }
            });

            await db.execute('DELETE FROM presentations WHERE id = ?', [id]);
            res.json({ success: true, message: 'Deleted successfully' });
        } catch (err) {
            res.json({ success: false, message: err.message });
        }
    });

    // ── Generate PPTX ────────────────────────────────────────────────────────
    router.post('/generate_pptx', async (req, res) => {
        const { presentation_id } = req.body;

        if (!presentation_id) {
            return res.json({ success: false, message: 'Presentation ID is required' });
        }

        try {
            const pptxPath = await generatePPTX(presentation_id, db);

            if (pptxPath && fs.existsSync(pptxPath)) {
                await db.execute(
                    "UPDATE presentations SET status = 'completed', file_path = ?, updated_at = NOW() WHERE id = ?",
                    [pptxPath, presentation_id]
                );
                res.json({ success: true, file_path: pptxPath, message: 'PPTX generated successfully' });
            } else {
                res.json({ success: false, message: 'PPTX file was not created' });
            }
        } catch (err) {
            console.error(err);
            res.json({ success: false, message: 'Error: ' + err.message });
        }
    });

    return router;
};
