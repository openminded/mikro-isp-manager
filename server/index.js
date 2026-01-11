import express from 'express';
import cors from 'cors';
import routeros from 'node-routeros';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { RouterOSAPI } = routeros;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// Ensure directories
if (!fs.existsSync(path.join(__dirname, 'data'))) fs.mkdirSync(path.join(__dirname, 'data'));
if (!fs.existsSync(path.join(__dirname, 'uploads'))) fs.mkdirSync(path.join(__dirname, 'uploads'));

app.use(cors());
app.use(express.json());
// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// DB Helper
const DB_FILE = path.join(__dirname, 'data', 'customers.json');
const getDB = () => {
    if (!fs.existsSync(DB_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) { return {}; }
};
const saveDB = (data) => {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
};

// Multer Config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'uploads')); // store in server/uploads
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Proxy endpoint for Binary API
app.post('/api/proxy', async (req, res) => {
    const { host, port, user, password, command } = req.body;

    if (!host || !command) {
        return res.status(400).json({ error: 'Missing host or command' });
    }

    const client = new RouterOSAPI({
        host,
        port: port || 8728,
        user,
        password,
        keepalive: false,
        timeout: 15 // Increased timeout slightly
    });

    // Prevent crashing on unhandled socket errors
    client.on('error', (err) => {
        console.error('[Proxy] Client Error:', err.message);
    });

    try {
        console.log(`[Proxy] Connecting to ${host}:${port || 8728}...`);
        await client.connect();

        console.log(`[Proxy] Running: ${command}`);
        const data = await client.write(command);

        await client.close();

        res.json(data);
    } catch (error) {
        console.error('[Proxy] Error:', error.message);
        try { client.close(); } catch (e) { }
        res.status(500).json({ error: error.message });
    }
});

// --- CRM Endpoints ---

// Get All Meta Data
app.get('/api/customers/meta', (req, res) => {
    const db = getDB();
    res.json(db);
});

// Update/Create Meta Data for a Customer
app.post('/api/customers/meta', (req, res) => {
    const { serverId, customerId, ...metaData } = req.body; // customerId can be username or .id, sticking to persistent ID if possible, but username is safer across resets? using composite key.

    // We will use a composite key: serverId_username (since .id changes on router reset)
    // Or simpler: just use what the frontend sends as key.
    // Let's assume frontend sends a unique key "serverId_username"

    const key = `${serverId}_${customerId}`;

    if (!serverId || !customerId) {
        return res.status(400).json({ error: 'Missing Identity' });
    }

    const db = getDB();
    db[key] = { ...db[key], ...metaData, lastUpdated: new Date() };
    saveDB(db);

    res.json({ success: true, data: db[key] });

});

// --- Profiles Metadata ---
const DB_PROFILES_FILE = path.join(__dirname, 'data', 'profiles.json');
const getProfilesDB = () => {
    if (!fs.existsSync(DB_PROFILES_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(DB_PROFILES_FILE, 'utf8'));
    } catch (e) { return {}; }
};
const saveProfilesDB = (data) => {
    fs.writeFileSync(DB_PROFILES_FILE, JSON.stringify(data, null, 2));
};

app.get('/api/profiles/meta', (req, res) => {
    const db = getProfilesDB();
    res.json(db);
});

app.post('/api/profiles/meta', (req, res) => {
    const { serverId, profileId, profileName, ...metaData } = req.body;

    // Key strategy: serverId_profileName (names are unique per router, IDs change)
    if (!serverId || !profileName) {
        return res.status(400).json({ error: 'Missing Identity' });
    }

    const key = `${serverId}_${profileName}`;
    const db = getProfilesDB();
    db[key] = { ...db[key], ...metaData, lastUpdated: new Date() };
    saveProfilesDB(db);

    res.json({ success: true, data: db[key] });
});

// Upload Photos
app.post('/api/upload', upload.array('photos', 5), (req, res) => {
    // Returns list of filenames
    if (!req.files) return res.status(400).json({ error: 'No files uploaded' });

    const urls = req.files.map(f => `/uploads/${f.filename}`);
    res.json({ urls });
});

app.listen(PORT, () => {
    console.log(`Mikrotik API Proxy + CRM DB running on http://localhost:${PORT}`);
});
