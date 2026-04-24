import express from 'express';

const router = express.Router();

/**
 * WhatsApp Feature Disabled
 * Requested by user to remove broadcast functionality.
 */

router.get('/status', (req, res) => {
    res.json({ status: 'disabled', message: 'WhatsApp feature has been removed.' });
});

router.post('/send', (req, res) => {
    res.status(410).json({ error: 'Feature removed' });
});

router.post('/broadcast', (req, res) => {
    res.status(410).json({ error: 'Feature removed' });
});

router.get('/logs', (req, res) => {
    res.json([]);
});

router.delete('/logs', (req, res) => {
    res.json({ success: true });
});

router.post('/logout', (req, res) => {
    res.json({ success: true });
});

export default router;
