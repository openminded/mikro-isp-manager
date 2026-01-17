
import { makeWASocket, DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import pino from 'pino';
import path from 'path';
import fs from 'fs';
import express from 'express';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const LOG_FILE = path.join(__dirname, 'data', 'broadcast_logs.json');

// Log Helper
const getLogs = () => {
    if (!fs.existsSync(LOG_FILE)) return [];
    try {
        return JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
    } catch { return []; }
};
const saveLogs = (logs) => {
    fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
};

let sock;
let qrCode = null;
let status = 'disconnected'; // disconnected, connecting, connected
let connectionRetryCount = 0;

const AUTH_DIR = path.join(__dirname, 'data', 'auth_info_baileys');
if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
}

async function connectToWhatsApp() {
    status = 'connecting';
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true, // Useful for server logs
        auth: state,
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            qrCode = qr;
            status = 'scan_qr';
            console.log('[WhatsApp] QR Code received');
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('[WhatsApp] Connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
            status = 'disconnected';
            qrCode = null;

            if (shouldReconnect) {
                if (connectionRetryCount < 5) {
                    connectionRetryCount++;
                    setTimeout(connectToWhatsApp, 3000); // Retry after 3s
                }
            } else {
                console.log('[WhatsApp] Logged out. Delete auth and restart to scan again.');
                // Clean up logic if needed
            }
        } else if (connection === 'open') {
            console.log('[WhatsApp] Opened connection');
            status = 'connected';
            qrCode = null;
            connectionRetryCount = 0;
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

// Start connection immediately
connectToWhatsApp();

// --- Routes ---

router.get('/status', (req, res) => {
    res.json({ status, qr: qrCode, user: sock?.user });
});

router.post('/send', async (req, res) => {
    const { phone, message } = req.body; // Phone should be full number with country code, e.g., 628123456789

    if (status !== 'connected') {
        return res.status(400).json({ error: 'WhatsApp not connected' });
    }

    if (!phone || !message) {
        return res.status(400).json({ error: 'Phone and message are required' });
    }

    try {
        // Format phone: if starts with 08, change to 628. If just numbers, assume good.
        // Good practice: append @s.whatsapp.net
        let jid = phone;
        if (!jid.includes('@s.whatsapp.net')) {
            // Simple sanitization
            jid = jid.replace(/\D/g, ''); // remove non-digits
            if (jid.startsWith('0')) jid = '62' + jid.slice(1);
            jid = jid + '@s.whatsapp.net';
        }

        await sock.sendMessage(jid, { text: message });
        res.json({ success: true });
    } catch (error) {
        console.error('[WhatsApp] Send error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Broadcast (Bulk Send)
router.post('/broadcast', async (req, res) => {
    const { targets, message } = req.body; // targets: array of objects { phone, name, server, profile, price }

    if (status !== 'connected') {
        return res.status(400).json({ error: 'WhatsApp not connected' });
    }

    if (!targets || !Array.isArray(targets) || targets.length === 0 || !message) {
        return res.status(400).json({ error: 'Valid targets list and message are required' });
    }

    // Process in background to avoid timeout
    res.json({ success: true, message: `Started broadcasting to ${targets.length} targets` });

    // Initialize Log Entry
    const logs = getLogs();
    const logId = Date.now().toString(); // simple ID
    const newLog = {
        id: logId,
        date: new Date().toISOString(),
        messageSnippet: message.length > 50 ? message.substring(0, 50) + '...' : message,
        total: targets.length,
        success: 0,
        failed: 0,
        status: 'sending'
    };
    logs.unshift(newLog); // Add to top
    saveLogs(logs);

    console.log(`[Broadcast] Starting broadcast to ${targets.length} numbers...`);

    let successCount = 0;
    let failCount = 0;

    // Async processing to update logs
    (async () => {
        for (const target of targets) {
            // Delay to avoid spam detection (random 2-5s)
            const delay = Math.floor(Math.random() * 3000) + 2000;
            await new Promise(r => setTimeout(r, delay));

            // Handle string target (backward compatibility) or object target
            const phone = typeof target === 'string' ? target : target.phone;

            if (!phone) {
                failCount++;
                continue;
            }

            try {
                let jid = phone;
                if (!jid.includes('@s.whatsapp.net')) {
                    jid = jid.replace(/\D/g, '');
                    if (jid.startsWith('0')) jid = '62' + jid.slice(1);
                    jid = jid + '@s.whatsapp.net';
                }

                // Variable Substitution
                let personalizedMessage = message;
                if (typeof target === 'object') {
                    personalizedMessage = personalizedMessage
                        .replace(/{name}/g, target.name || '')
                        .replace(/{server}/g, target.server || '')
                        .replace(/{profile}/g, target.profile || '')
                        .replace(/{price}/g, target.price || '');
                }

                await sock.sendMessage(jid, { text: personalizedMessage });
                successCount++;
            } catch (error) {
                console.error(`[Broadcast] Failed to send to ${phone}:`, error.message);
                failCount++;
            }
        }

        console.log(`[Broadcast] Finished. Success: ${successCount}, Failed: ${failCount}`);

        // Update Log status
        const finalLogs = getLogs();
        const logIndex = finalLogs.findIndex(l => l.id === logId);
        if (logIndex !== -1) {
            finalLogs[logIndex].success = successCount;
            finalLogs[logIndex].failed = failCount;
            finalLogs[logIndex].status = 'completed';
            saveLogs(finalLogs);
        }
    })();
});

// Logs Endpoints
router.get('/logs', (req, res) => {
    res.json(getLogs());
});
router.delete('/logs', (req, res) => {
    saveLogs([]);
    res.json({ success: true });
});

router.post('/logout', async (req, res) => {
    try {
        await sock.logout();
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        status = 'disconnected';
        qrCode = null;
        connectToWhatsApp(); // Restart to allow new scan
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
