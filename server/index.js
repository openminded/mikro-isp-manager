import express from 'express';
import cors from 'cors';
import routeros from 'node-routeros';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

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

// --- Mikrotik Cache Endpoints ---

// Helper to get cache file path
const getCachePath = (serverId, resource) => {
    // resource: 'secrets', 'profiles', 'pools', 'interfaces'
    return path.join(__dirname, 'data', `cache_${serverId}_${resource}.json`);
};

// Sync Data: Fetch from Mikrotik -> Save to JSON -> Return Data
app.post('/api/mikrotik/sync', async (req, res) => {
    const { server, resource } = req.body; // server object, resource string

    if (!server || !resource) {
        return res.status(400).json({ error: 'Missing server or resource' });
    }

    // Map resource to command
    let command;
    switch (resource) {
        case 'secrets': command = '/ppp/secret/print'; break;
        case 'profiles': command = '/ppp/profile/print'; break;
        case 'pools': command = '/ip/pool/print'; break;
        case 'interfaces': command = '/interface/print'; break;
        case 'active_ppp': command = '/ppp/active/print'; break;
        default: return res.status(400).json({ error: 'Invalid resource type' });
    }

    const client = new RouterOSAPI({
        host: server.ip,
        port: server.port || 8728,
        user: server.username,
        password: server.password,
        keepalive: false,
        timeout: 20
    });

    try {
        await client.connect();
        const data = await client.write(command);
        await client.close();

        // Save to cache
        const cachePath = getCachePath(server.id, resource);
        const cacheData = {
            timestamp: new Date().toISOString(),
            data: Array.isArray(data) ? data : []
        };
        fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2));

        res.json(cacheData);
    } catch (error) {
        console.error(`[Sync] Failed to sync ${resource} for ${server.ip}:`, error.message);
        try { client.close(); } catch (e) { }
        res.status(500).json({ error: error.message });
    }
});

// Read Cached Data
app.get('/api/mikrotik/data', (req, res) => {
    const { serverId, resource } = req.query;

    if (!serverId || !resource) {
        return res.status(400).json({ error: 'Missing serverId or resource' });
    }

    const cachePath = getCachePath(serverId, resource);

    if (!fs.existsSync(cachePath)) {
        return res.json({ timestamp: null, data: [] });
    }

    try {
        const fileContent = fs.readFileSync(cachePath, 'utf8');
        const cacheData = JSON.parse(fileContent);
        res.json(cacheData);
    } catch (error) {
        res.json({ timestamp: null, data: [] });
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

// --- Servers Metadata (Migration from LocalStorage) ---
const DB_SERVERS_FILE = path.join(__dirname, 'data', 'servers.json');
const getServersDB = () => {
    if (!fs.existsSync(DB_SERVERS_FILE)) return [];
    try {
        const data = JSON.parse(fs.readFileSync(DB_SERVERS_FILE, 'utf8'));
        return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
};
const saveServersDB = (data) => {
    fs.writeFileSync(DB_SERVERS_FILE, JSON.stringify(data, null, 2));
};

app.get('/api/servers', (req, res) => {
    const db = getServersDB();
    res.json(db);
});

app.post('/api/servers', (req, res) => {
    const newServer = req.body;
    if (!newServer.id) newServer.id = crypto.randomUUID(); // Ensure ID exists if not provided

    // Validate required fields
    if (!newServer.name || !newServer.ip || !newServer.username) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const db = getServersDB();
    db.push(newServer);
    saveServersDB(db);
    res.json(newServer);
});

app.put('/api/servers/:id', (req, res) => {
    const { id } = req.params;
    const updatedData = req.body;
    const db = getServersDB();
    const index = db.findIndex(s => s.id === id);

    if (index === -1) {
        return res.status(404).json({ error: 'Server not found' });
    }

    db[index] = { ...db[index], ...updatedData };
    saveServersDB(db);
    res.json(db[index]);
});

app.delete('/api/servers/:id', (req, res) => {
    const { id } = req.params;
    let db = getServersDB();
    db = db.filter(s => s.id !== id);
    saveServersDB(db);
    res.json({ success: true });
});


// Upload Photos
app.post('/api/upload', upload.array('photos', 5), (req, res) => {
    // Returns list of filenames
    if (!req.files) return res.status(400).json({ error: 'No files uploaded' });

    const urls = req.files.map(f => `/uploads/${f.filename}`);
    res.json({ urls });
});

// --- Registration & Working Order ---
const DB_REGISTRATIONS_FILE = path.join(__dirname, 'data', 'registrations.json');
const getRegistrationsDB = () => {
    if (!fs.existsSync(DB_REGISTRATIONS_FILE)) return [];
    try {
        const data = JSON.parse(fs.readFileSync(DB_REGISTRATIONS_FILE, 'utf8'));
        return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
};
const saveRegistrationsDB = (data) => {
    fs.writeFileSync(DB_REGISTRATIONS_FILE, JSON.stringify(data, null, 2));
};

// Get Registrations
app.get('/api/registrations', (req, res) => {
    const db = getRegistrationsDB();
    res.json(db);
});

// Create Registration
app.post('/api/registrations', (req, res) => {
    const newReg = req.body;
    if (!newReg.id) newReg.id = crypto.randomUUID();
    if (!newReg.createdAt) newReg.createdAt = new Date().toISOString();
    if (!newReg.status) newReg.status = 'queue'; // Default status

    // Validation
    if (!newReg.phoneNumber || !newReg.fullName) {
        return res.status(400).json({ error: 'Phone Number and Name are required' });
    }

    const db = getRegistrationsDB();
    db.push(newReg);
    saveRegistrationsDB(db);
    res.json(newReg);
});

// Update Registration (General & Status)
app.put('/api/registrations/:id', (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const db = getRegistrationsDB();
    const index = db.findIndex(r => r.id === id);

    if (index === -1) {
        return res.status(404).json({ error: 'Registration not found' });
    }

    // Merge updates
    db[index] = { ...db[index], ...updates };

    // Logic: If status becomes 'installation_process' and no workingOrderStatus yet, set it to 'pending'
    if (db[index].status === 'installation_process' && !db[index].workingOrderStatus) {
        db[index].workingOrderStatus = 'pending';
    }

    saveRegistrationsDB(db);
    res.json(db[index]);
});

// Delete Registration
app.delete('/api/registrations/:id', (req, res) => {
    const { id } = req.params;
    let db = getRegistrationsDB();
    db = db.filter(r => r.id !== id);
    saveRegistrationsDB(db);
    res.json({ success: true });
});

// --- Job Titles ---
const DB_JOB_TITLES_FILE = path.join(__dirname, 'data', 'job_titles.json');
const getJobTitlesDB = () => {
    if (!fs.existsSync(DB_JOB_TITLES_FILE)) return [];
    try {
        const data = JSON.parse(fs.readFileSync(DB_JOB_TITLES_FILE, 'utf8'));
        return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
};
const saveJobTitlesDB = (data) => {
    fs.writeFileSync(DB_JOB_TITLES_FILE, JSON.stringify(data, null, 2));
};

app.get('/api/job-titles', (req, res) => {
    res.json(getJobTitlesDB());
});

app.post('/api/job-titles', (req, res) => {
    const newItem = req.body;
    if (!newItem.id) newItem.id = crypto.randomUUID();
    if (!newItem.createdAt) newItem.createdAt = new Date().toISOString();

    if (!newItem.name) return res.status(400).json({ error: 'Name is required' });

    const db = getJobTitlesDB();
    db.push(newItem);
    saveJobTitlesDB(db);
    res.json(newItem);
});

app.put('/api/job-titles/:id', (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const db = getJobTitlesDB();
    const index = db.findIndex(i => i.id === id);
    if (index === -1) return res.status(404).json({ error: 'Not found' });

    db[index] = { ...db[index], ...updates };
    saveJobTitlesDB(db);
    res.json(db[index]);
});

app.delete('/api/job-titles/:id', (req, res) => {
    const { id } = req.params;
    let db = getJobTitlesDB();
    db = db.filter(i => i.id !== id);
    saveJobTitlesDB(db);
    res.json({ success: true });
});

// --- Employees ---
const DB_EMPLOYEES_FILE = path.join(__dirname, 'data', 'employees.json');
const getEmployeesDB = () => {
    if (!fs.existsSync(DB_EMPLOYEES_FILE)) return [];
    try {
        const data = JSON.parse(fs.readFileSync(DB_EMPLOYEES_FILE, 'utf8'));
        return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
};
const saveEmployeesDB = (data) => {
    fs.writeFileSync(DB_EMPLOYEES_FILE, JSON.stringify(data, null, 2));
};

app.get('/api/employees', (req, res) => {
    res.json(getEmployeesDB());
});

app.post('/api/employees', (req, res) => {
    const newItem = req.body;
    if (!newItem.id) newItem.id = crypto.randomUUID();
    if (!newItem.createdAt) newItem.createdAt = new Date().toISOString();

    if (!newItem.name || !newItem.phoneNumber || !newItem.jobTitleId) {
        return res.status(400).json({ error: 'Name, Phone, and Job Title are required' });
    }

    const db = getEmployeesDB();
    db.push(newItem);
    saveEmployeesDB(db);
    res.json(newItem);
});

app.put('/api/employees/:id', (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const db = getEmployeesDB();
    const index = db.findIndex(i => i.id === id);
    if (index === -1) return res.status(404).json({ error: 'Not found' });

    db[index] = { ...db[index], ...updates };
    saveEmployeesDB(db);
    res.json(db[index]);
});

app.delete('/api/employees/:id', (req, res) => {
    const { id } = req.params;
    let db = getEmployeesDB();
    db = db.filter(i => i.id !== id);
    saveEmployeesDB(db);
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Mikrotik API Proxy + CRM DB running on http://localhost:${PORT}`);
});
