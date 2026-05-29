import express from 'express';
import cors from 'cors';
import routeros from 'node-routeros';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { initDB, Server, Invoice, Payment, Customer, InvoiceHistory, RemoteDevice, OnuChangeLog } from './models/index.js';
import { Sequelize, Op } from 'sequelize';
import archiver from 'archiver';
import AdmZip from 'adm-zip';
import PDFDocument from 'pdfkit';

const { RouterOSAPI } = routeros;
const APP_VERSION = '1.0.3-BULK-DELETE-PAYMENTS';



// Initialize Database
initDB();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Global Uncaught Exception Handler to prevent process crash
process.on('uncaughtException', (err) => {
    console.error('[CRITICAL] Uncaught Exception:', err.message);
    console.error(err.stack);
    // Don't exit, just log it. The next request will try again.
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0';

// --- Helper Functions & Database Setup ---

const DB_LOGS_FILE = path.join(__dirname, 'data', 'logs.json');
const getLogsDB = () => CACHE.logs;
const saveLogsDB = (data) => {
    CACHE.logs = data;
    queueWrite('logs', data);
};


const getSessionsDB = () => CACHE.sessions;
const saveSessionsDB = (data) => {
    CACHE.sessions = data;
    queueWrite('sessions', data);
};



const logActivity = async (req, action, details, level = 'info') => {
    try {
        let username = 'system';
        let role = 'system';

        const authHeader = req.headers.authorization;
        if (authHeader) {
            const token = authHeader.split(' ')[1];
            const sessions = getSessionsDB();
            if (sessions[token]) {
                username = sessions[token].username;
                role = sessions[token].role;
            }
        }

        if (action === 'LOGIN' && details.username) {
            username = details.username;
            role = details.role || 'unknown';
        }

        const logEntry = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            level,
            username,
            role,
            action,
            details: typeof details === 'string' ? details : JSON.stringify(details),
            ip: req.ip || req.connection?.remoteAddress || 'unknown'
        };

        // [CONFIG] Check if this action should be logged
        if (CACHE.loggingConfig && CACHE.loggingConfig[action] === false) {
            return;
        }

        // [OPTIMIZED] Use Cache instead of reading from disk on every log!
        const logs = CACHE.logs || [];
        logs.unshift(logEntry);
        if (logs.length > 5000) logs.length = 5000;
        
        CACHE.logs = logs;
        queueWrite('logs', logs);

        console.log(`[LOG] ${action}: ${username} - ${logEntry.details}`);

    } catch (e) {
        console.error('Failed to write log:', e.message);
    }
};


// --- Global Error Handlers (Stability) ---
process.on('uncaughtException', (err) => {
    console.error('[CRITICAL] Uncaught Exception:', err.message);
    console.error(err.stack);
    // In production, you might want to log this to a persistent file
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});




// Ensure directories
if (!fs.existsSync(path.join(__dirname, 'data'))) fs.mkdirSync(path.join(__dirname, 'data'));
if (!fs.existsSync(path.join(__dirname, 'uploads'))) fs.mkdirSync(path.join(__dirname, 'uploads'));

app.use(cors());
app.use(express.json());

// --- Debugging Middleware ---
app.use((req, res, next) => {
    console.log(`[REQ] ${req.method} ${req.url}`);
    next();
});

// [DEBUG] Simple Connectivity Check
app.get('/api/ping', (req, res) => {
    console.log('[DEBUG] HIT /api/ping');
    res.json({ status: 'PONG', version: APP_VERSION });
});


// --- In-Memory Cache for JSON DBs (Performance & 502 prevention) ---
const CACHE = {
    logs: [],
    sessions: {},
    customers: {},
    profiles: {},
    registrations: [],
    jobTitles: [],
    employees: [],
    damageTypes: [],
    subAreas: [],
    tickets: [],
    paymentMethods: [],
    networkNodes: [],
    users: [],
    status: {},
    loggingConfig: {}
};

// Initial Load Function
const loadJsonToCache = (file, cacheKey, isArray = true) => {
    try {
        if (fs.existsSync(file)) {
            const data = JSON.parse(fs.readFileSync(file, 'utf8'));
            CACHE[cacheKey] = data;
        }
    } catch (e) {
        console.error(`[Cache] Failed to load ${cacheKey} from ${file}:`, e.message);
        CACHE[cacheKey] = isArray ? [] : {};
    }
};

const DB_FILES = {
    logs: path.join(__dirname, 'data', 'logs.json'),
    sessions: path.join(__dirname, 'data', 'sessions.json'),
    customers: path.join(__dirname, 'data', 'customers.json'),
    profiles: path.join(__dirname, 'data', 'profiles.json'),
    registrations: path.join(__dirname, 'data', 'registrations.json'),
    jobTitles: path.join(__dirname, 'data', 'job_titles.json'),
    employees: path.join(__dirname, 'data', 'employees.json'),
    damageTypes: path.join(__dirname, 'data', 'damage_types.json'),
    subAreas: path.join(__dirname, 'data', 'sub_areas.json'),
    tickets: path.join(__dirname, 'data', 'tickets.json'),
    paymentMethods: path.join(__dirname, 'data', 'payment_methods.json'),
    networkNodes: path.join(__dirname, 'data', 'network_nodes.json'),
    users: path.join(__dirname, 'data', 'users.json'),
    status: path.join(__dirname, 'data', 'network_status.json'),
    loggingConfig: path.join(__dirname, 'data', 'logging_config.json')
};

// Ensure data directory exists before loading
if (!fs.existsSync(path.join(__dirname, 'data'))) fs.mkdirSync(path.join(__dirname, 'data'));

// Load all to cache on startup
Object.keys(DB_FILES).forEach(key => {
    const isArray = ['logs', 'registrations', 'jobTitles', 'employees', 'damageTypes', 'subAreas', 'tickets', 'paymentMethods', 'networkNodes', 'users'].includes(key);
    loadJsonToCache(DB_FILES[key], key, isArray);
});

// [NEW] Serialized Write Queue for DB Stability (Prevents 502s from file contention)
const writeQueues = {};

const queueWrite = async (key, data, customPath = null) => {
    const queueKey = customPath || key;
    if (!writeQueues[queueKey]) {
        writeQueues[queueKey] = Promise.resolve();
    }
    
    // Chain the write operations to ensure serial execution per file
    writeQueues[queueKey] = writeQueues[queueKey].then(async () => {
        try {
            const filePath = customPath || DB_FILES[key];
            if (!filePath) return;

            // Optimization: Remove pretty-printing for large data files to save CPU/Disk IO
            const isLarge = ['logs', 'registrations', 'customers', 'tickets'].includes(key) || (customPath && customPath.includes('cache_'));
            const json = isLarge ? JSON.stringify(data) : JSON.stringify(data, null, 2);
            
            await fs.promises.writeFile(filePath, json);
        } catch (e) {
            console.error(`[QueueWrite] Async write failed for ${queueKey}:`, e.message);
        }
    });

    return writeQueues[queueKey];
};


// [NEW] Migration: Standardize Customer Meta Keys from _ to -
if (CACHE.customers && typeof CACHE.customers === 'object') {
    let migrated = false;
    Object.keys(CACHE.customers).forEach(key => {
        // Find keys using underscore as separator (UUID_NAME)
        if (key.includes('_')) {
            const newKey = key.replace('_', '-').toLowerCase().trim();
            if (newKey !== key) {
                CACHE.customers[newKey] = { ...CACHE.customers[key] };
                delete CACHE.customers[key];
                migrated = true;
            }
        } else if (key !== key.toLowerCase().trim()) {
            const newKey = key.toLowerCase().trim();
            CACHE.customers[newKey] = { ...CACHE.customers[key] };
            delete CACHE.customers[key];
            migrated = true;
        }
    });
    if (migrated) {
        console.log('[Migration] Standardized customer keys (Lowercase + Hyphen) in CACHE.customers');
        queueWrite('customers', CACHE.customers);
    }
}

// Health Check & Version
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        version: APP_VERSION, 
        time: new Date().toISOString(),
        db: 'connected'
    });
});


// [DEBUG] Explicit Customers Route (Priority)
app.get('/api/customers', async (req, res) => {

    console.log('[DEBUG] HIT /api/customers');
    try {
        // Use models imported at line 9
        const servers = await Server.findAll();
        const sqlCustomers = await Customer.findAll();
        
        const sqlMap = new Map();
        sqlCustomers.forEach(c => {
            const key = `${String(c.server_id).toLowerCase()}-${String(c.mikrotik_name).toLowerCase().trim()}`;
            sqlMap.set(key, c.toJSON());
        });

        const mergedList = [];
        const processedKeys = new Set();

        for (const server of servers) {
            const cachePath = getCachePath(server.id, 'secrets');
            let cacheData = [];
            if (fs.existsSync(cachePath)) {

                try {
                    const rawData = await fs.promises.readFile(cachePath, 'utf8');
                    const cache = JSON.parse(rawData);
                    if (Array.isArray(cache.data)) cacheData = cache.data;
                } catch (e) { }
            }


            for (const secret of cacheData) {
                const key = `${String(server.id).toLowerCase()}-${String(secret.name).toLowerCase().trim()}`;
                const sqlC = sqlMap.get(key);
                processedKeys.add(key);
                
                let lat = null, long = null;
                if (sqlC?.coordinates?.includes(',')) {
                    const parts = sqlC.coordinates.split(',');
                    lat = parts[0].trim();
                    long = parts[1].trim();
                }

                mergedList.push({
                    id: sqlC ? sqlC.id : (secret['.id'] || secret.name),
                    serverId: server.id,
                    serverName: server.name,
                    name: secret.name, // username
                    realName: sqlC ? (sqlC.name || '') : '',
                    comment: secret.comment || (sqlC ? sqlC.comment : ''),
                    profile: secret.profile || (sqlC ? sqlC.profile : 'default'),
                    'remote-address': secret['remote-address'] || '-',
                    'last-logged-out': secret['last-logged-out'] || '-',
                    whatsapp: sqlC ? (sqlC.phone_number || '') : '',
                    address: sqlC ? (sqlC.address || '-') : '-',
                    lat: lat || '',
                    long: long || '',
                    ktp: sqlC ? (sqlC.ktp || '') : '',
                    activationDate: sqlC ? (sqlC.activationDate || '') : '',
                    installationDate: sqlC ? (sqlC.installationDate || '') : '',
                    ssidName: sqlC ? (sqlC.ssidName || '') : '',
                    ssidPassword: sqlC ? (sqlC.ssidPassword || '') : '',
                    signalLevel: sqlC ? (sqlC.signalLevel || '') : '',
                    sub_area_id: sqlC ? (sqlC.sub_area_id || '') : '',
                    photos: sqlC ? (sqlC.photos || []) : [],
                    disabled: secret.disabled === 'true' || secret.disabled === 'yes' || secret.disabled === true
                });
            }
        }
        res.json(mergedList);
    } catch (e) {
        console.error('Error fetching customers:', e);
        res.status(500).json({ error: e.message });
    }
});

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// DB Helper
const getDB = () => CACHE.customers;
const saveDB = (data) => {
    CACHE.customers = data;
    queueWrite('customers', data);
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

// [COMPATIBILITY] Legacy/Alt endpoint for Mikrotik Import
app.post('/api/mikrotik-sync/import', async (req, res) => {
    console.log('[API] /api/mikrotik-sync/import called');
    // If this is intended to sync, we can reuse the logic if we have the params.
    // If the body is empty or different, we'll just return success to resolve the 404.
    res.json({ success: true, message: "Import endpoint active" });
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

    client.on('error', (err) => {
        console.error(`[Sync] Client Error for ${server.ip}:`, err.message);
    });

    const cachePath = getCachePath(server.id, resource);

    try {
        await client.connect();
        const data = await client.write(command);
        await client.close();

        // Save to cache
        const cacheData = {
            timestamp: new Date().toISOString(),
            data: Array.isArray(data) ? data : []
        };
        queueWrite('sync_cache', cacheData, cachePath);


        // [NEW] Sync Secrets to SQL Database
        if (resource === 'secrets' && Array.isArray(data)) {
            console.log(`[Sync] Updating SQL Database for ${server.ip} (${data.length} secrets)...`);

            // Ensure Server exists in DB first to satisfy Foreign Key
            const dbServer = await Server.findByPk(server.id);
            if (!dbServer) {
                // Ideally this shouldn't happen if server list is synced, but let's be safe
                // or just log warning. Front-end usually sends full server obj, maybe we can create/update it?
                // For now, let's assume it exists or try to find by ID.
                console.warn(`[Sync] Warning: Server ID ${server.id} not found in DB. Data might be orphaned.`);
                // Optional: Create it?
                await Server.findOrCreate({
                    where: { id: server.id },
                    defaults: {
                        name: server.name,
                        ip: server.ip,
                        username: server.username,
                        password: server.password
                    }
                });
            }

            for (const item of data) {
                if (!item.name) continue;

                try {
                    // Map status
                    let status = 'active';
                    if (item.disabled === 'true' || item.disabled === true) status = 'disabled';

                    const existing = await Customer.findOne({
                        where: { server_id: server.id, mikrotik_name: item.name }
                    });

                    if (existing) {
                        await existing.update({
                            profile: item.profile,
                            status: status,
                            comment: item.comment || ''
                        });
                    } else {
                        // Create new customer from Mikrotik
                        // username = PPP Secret name, comment = PPP Secret comment, real_name = from app DB
                        await Customer.create({
                            server_id: server.id,
                            mikrotik_name: item.name,   // PPP Secret: name
                            name: item.name,             // store ppp secret name (username) here too
                            profile: item.profile,
                            status: status,
                            comment: item.comment || '' // PPP Secret: comment
                        });
                    }
                } catch (err) {
                    console.error(`[Sync] Error updating secret ${item.name}:`, err.message);
                }
            }
            console.log(`[Sync] SQL Database updated.`);

            // [FIX] Merge SQL Data back into the Cache Response
            // The frontend relies on the cache (JSON) which currently only has Mikrotik data.
            // We need to enrich it with SQL fields (sub_area_id, real name, etc.)

            // 1. Fetch all SQL customers for this server
            const sqlCustomers = await Customer.findAll({ where: { server_id: server.id } });
            const sqlMap = new Map();
            sqlCustomers.forEach(c => {
                // Key lowercase to ensure case-insensitive matching with Mikrotik
                sqlMap.set(String(c.mikrotik_name).toLowerCase().trim(), c.toJSON());
            });

            // 2. Enrich Mikrotik Data
            data = data.map(item => {
                // Match by lowercase name
                const key = String(item.name).toLowerCase().trim();
                const sqlC = sqlMap.get(key);
                
                if (sqlC) {
                    return {
                        ...item,
                        // Override or Append fields from SQL
                        realName: sqlC.real_name, // Use the new real_name column
                        whatsapp: sqlC.phone_number,
                        address: sqlC.address,
                        sub_area_id: sqlC.sub_area_id,
                        odpId: sqlC.odp_id, // Map snake_case to camelCase for frontend
                        ktp: sqlC.ktp || '', 
                        coordinates: sqlC.coordinates,
                        installationDate: sqlC.installationDate,
                        ssidName: sqlC.ssidName,
                        ssidPassword: sqlC.ssidPassword,
                        signalLevel: sqlC.signalLevel,
                    };
                }
                return item;
            });

            // Update cache with Enriched Data
            const cacheDataFinal = {
                timestamp: new Date().toISOString(),
                data: Array.isArray(data) ? data : []
            };
            await queueWrite('sync_cache', cacheDataFinal, cachePath);


        } else {
             // For non-secrets, await the first queueWrite to ensure it finishes
             const cacheData = {
                timestamp: new Date().toISOString(),
                data: Array.isArray(data) ? data : []
             };
             await queueWrite('sync_cache', cacheData, cachePath);
        }

        // Return potentially enriched data
        res.json({ timestamp: new Date().toISOString(), data: Array.isArray(data) ? data : [] });
    } catch (error) {
        console.error(`[Sync] Failed to sync ${resource} for ${server.ip}:`, error.message);
        try { client.close(); } catch (e) { }
        res.status(500).json({ error: error.message });
    }
});

// Read Cached Data
app.get('/api/mikrotik/data', async (req, res) => {
    const { serverId, resource } = req.query;

    if (!serverId || !resource) {
        return res.status(400).json({ error: 'Missing serverId or resource' });
    }

    const cachePath = getCachePath(serverId, resource);

    if (!fs.existsSync(cachePath)) {
        return res.json({ timestamp: null, data: [] });
    }

    try {
        const fileContent = await fs.promises.readFile(cachePath, 'utf8');
        const cacheData = JSON.parse(fileContent);
        res.json(cacheData);
    } catch (error) {
        res.json({ timestamp: null, data: [] });
    }

});

// --- Offline ONU Logic ---
function parseMikrotikDate(dateStr) {
    if (!dateStr || dateStr === '-') return null;
    
    // Format 1: YYYY-MM-DD HH:mm:ss (RouterOS v7 / API format)
    if (dateStr.includes('-')) {
        const parts = dateStr.split(' ');
        if (parts.length !== 2) return null;
        const [year, month, day] = parts[0].split('-').map(Number);
        const [hours, minutes, seconds] = parts[1].split(':').map(Number);
        // Important: month is 0-indexed in JS Date
        return new Date(year, month - 1, day, hours, minutes, seconds);
    }

    // Format 2: mmm/DD/YYYY HH:mm:ss (RouterOS v6 format)
    if (dateStr.includes('/')) {
        const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
        const parts = dateStr.toLowerCase().split(' ');
        if (parts.length !== 2) return null;
        const dateParts = parts[0].split('/');
        if (dateParts.length !== 3) return null;
        const month = months[dateParts[0]];
        const day = parseInt(dateParts[1], 10);
        const year = parseInt(dateParts[2], 10);
        const timeParts = parts[1].split(':');
        if (timeParts.length !== 3) return null;
        const hours = parseInt(timeParts[0], 10);
        const minutes = parseInt(timeParts[1], 10);
        const seconds = parseInt(timeParts[2], 10);
        return new Date(year, month, day, hours, minutes, seconds);
    }
    
    return null;
}

app.get('/api/mikrotik/offline-onu', async (req, res) => {
    const { serverId } = req.query;
    if (!serverId) return res.status(400).json({ error: 'Missing serverId' });

    try {
        const secretsPath = getCachePath(serverId, 'secrets');
        const activePath = getCachePath(serverId, 'active_ppp');

        let secretsData = [];
        let activeData = [];

        if (fs.existsSync(secretsPath)) {
            const fileContent = await fs.promises.readFile(secretsPath, 'utf8');
            const parsed = JSON.parse(fileContent);
            if (Array.isArray(parsed.data)) secretsData = parsed.data;
        }

        if (fs.existsSync(activePath)) {
            const fileContent = await fs.promises.readFile(activePath, 'utf8');
            const parsed = JSON.parse(fileContent);
            if (Array.isArray(parsed.data)) activeData = parsed.data;
        }

        const activeNames = new Set(activeData.map(a => String(a.name).trim()));
        const sqlCustomers = await Customer.findAll({ where: { server_id: serverId } });
        const sqlMap = new Map();
        sqlCustomers.forEach(c => {
            sqlMap.set(String(c.mikrotik_name).toLowerCase().trim(), c.toJSON());
        });

        const now = new Date();
        const MAX_OFFLINE_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

        const offlineUsers = [];

        for (const secret of secretsData) {
            // Check if disabled
            if (secret.disabled === 'true' || secret.disabled === 'yes' || secret.disabled === true) {
                continue; // exclude disabled
            }

            const name = String(secret.name).trim();
            if (activeNames.has(name)) {
                continue; // exclude online
            }

            // Exclude profile BELUM AKTIF
            const profile = String(secret.profile).trim().toUpperCase();
            if (profile === 'BELUM AKTIF') {
                continue;
            }

            const lastLoggedOutStr = secret['last-logged-out'];
            const lastDate = parseMikrotikDate(lastLoggedOutStr);
            if (!lastDate) {
                continue; // skip if no valid date
            }

            const diffMs = now.getTime() - lastDate.getTime();
            
            // Allow negative slightly in case server clock differs, but strictly <= 3 days
            if (diffMs > MAX_OFFLINE_MS) {
                continue; // > 3x24h
            }

            // Calculate formatted duration
            let durationStr = '-';
            if (diffMs > 0) {
                const diffSecs = Math.floor(diffMs / 1000);
                const d = Math.floor(diffSecs / (3600 * 24));
                const h = Math.floor((diffSecs % (3600 * 24)) / 3600);
                const m = Math.floor((diffSecs % 3600) / 60);
                const s = diffSecs % 60;
                
                const parts = [];
                if (d > 0) parts.push(`${d}d`);
                if (h > 0) parts.push(`${h}h`);
                if (m > 0) parts.push(`${m}m`);
                if (s > 0 && d === 0) parts.push(`${s}s`);
                durationStr = parts.join(' ');
            } else {
                durationStr = 'Just now';
            }

            const key = name.toLowerCase();
            const sqlC = sqlMap.get(key);

            offlineUsers.push({
                id: secret['.id'] || name,
                name: name,
                realName: sqlC ? (sqlC.name || '') : '',
                profile: secret.profile || '-',
                comment: secret.comment || (sqlC ? sqlC.comment : ''),
                lastLoggedOut: lastLoggedOutStr,
                lastLoggedOutDate: lastDate.toISOString(),
                offlineDurationMs: diffMs > 0 ? diffMs : 0,
                offlineDurationStr: durationStr
            });
        }

        res.json(offlineUsers);
    } catch (error) {
        console.error('[Offline ONU]', error);
        res.status(500).json({ error: error.message });
    }
});

// --- Mikrotik Firewall NAT (Remote Devices) ---

// Get NAT Rules (from Database)
app.get('/api/mikrotik/nat', async (req, res) => {
    const { serverId } = req.query;
    if (!serverId) return res.status(400).json({ error: 'Missing serverId' });

    try {
        const rules = await RemoteDevice.findAll({ 
            where: { server_id: serverId },
            order: [['comment', 'ASC']]
        });
        res.json(rules);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Check NAT Rule Status on Mikrotik
app.get('/api/mikrotik/nat/check', async (req, res) => {
    const { serverId, id } = req.query;
    if (!serverId || !id) return res.status(400).json({ error: 'Missing params' });

    try {
        const rule = await RemoteDevice.findByPk(id);
        if (!rule) return res.status(404).json({ error: 'Rule not found in DB' });

        const server = await Server.findByPk(serverId);
        if (!server) return res.status(404).json({ error: 'Server not found' });

        const client = new RouterOSAPI({
            host: server.ip,
            port: server.port || 8728,
            user: server.username,
            password: server.password,
            keepalive: false,
            timeout: 15
        });

        await client.connect();
        // Look for rule by comment
        const mikrotikRules = await client.write(['/ip/firewall/nat/print', `?comment=${rule.comment}`]);
        await client.close();

        const exists = mikrotikRules.length > 0;
        const status = exists ? 'online' : 'offline';
        
        await rule.update({ last_check_status: status });
        res.json({ status, mikrotikData: mikrotikRules[0] || null });
    } catch (e) {
        console.error('[NAT Check] Failed:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Sync NAT Rules from Mikrotik (Discovery)
app.post('/api/mikrotik/nat/sync', async (req, res) => {
    const { serverId } = req.body;
    if (!serverId) return res.status(400).json({ error: 'Missing serverId' });

    try {
        const server = await Server.findByPk(serverId);
        if (!server) return res.status(404).json({ error: 'Server not found' });

        const client = new RouterOSAPI({
            host: server.ip, port: server.port || 8728,
            user: server.username, password: server.password,
            keepalive: false, timeout: 30 // High timeout for bulk read
        });

        await client.connect();
        // Fetch ALL NAT rules to ensure we don't miss any due to API query quirks
        const mikrotikRules = await client.write(['/ip/firewall/nat/print']);
        await client.close();

        // Filter rules in JS: contain both "remote" and "online" anywhere in comment
        const remoteRules = mikrotikRules.filter(r => {
            if (!r.comment) return false;
            const comment = r.comment.toLowerCase();
            return comment.includes('remote') && comment.includes('online');
        });
        
        console.log(`[NAT Sync] Found ${mikrotikRules.length} total rules, ${remoteRules.length} matching "remote"`);

        const syncedIds = [];
        for (const nat of remoteRules) {
            // Find or Create in DB
            const [rule, created] = await RemoteDevice.findOrCreate({
                where: { server_id: serverId, comment: nat.comment },
                defaults: {
                    dst_port: String(nat['dst-port'] || ''),
                    to_address: nat['to-addresses'] || '',
                    to_ports: String(nat['to-ports'] || ''),
                    protocol: nat.protocol || 'tcp',
                    last_check_status: 'online'
                }
            });

            if (!created) {
                // Update existing if settings changed on Mikrotik
                await rule.update({
                    dst_port: String(nat['dst-port'] || ''),
                    to_address: nat['to-addresses'] || '',
                    to_ports: String(nat['to-ports'] || ''),
                    protocol: nat.protocol || 'tcp',
                    last_check_status: 'online'
                });
            }
            syncedIds.push(rule.id);
        }

        // Remove rules from DB that are no longer on Mikrotik or no longer have "remote" in comment
        if (syncedIds.length > 0) {
            await RemoteDevice.destroy({
                where: {
                    server_id: serverId,
                    id: { [Op.notIn]: syncedIds }
                }
            });
        } else {
            // If no remote rules found, clear all remote devices for this server
            await RemoteDevice.destroy({ where: { server_id: serverId } });
        }

        res.json({ success: true, count: syncedIds.length });
    } catch (e) {
        console.error('[NAT Sync] Failed:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Update/Sync NAT Rule
app.put('/api/mikrotik/nat', async (req, res) => {
    const { serverId, id, toAddress, toPorts, comment, dstPort } = req.body;
    if (!serverId || !id) return res.status(400).json({ error: 'Missing serverId or rule id' });

    try {
        const rule = await RemoteDevice.findByPk(id);
        if (!rule) return res.status(404).json({ error: 'Rule not found' });

        const comment = rule.comment; // Comment is read-only for identification

        // 1. Update DB
        await rule.update({
            dst_port: dstPort ? String(dstPort) : rule.dst_port,
            to_address: toAddress || rule.to_address,
            to_ports: toPorts ? String(toPorts) : rule.to_ports
        });

        // 2. Push to Mikrotik
        const server = await Server.findByPk(serverId);
        if (server) {
            const client = new RouterOSAPI({
                host: server.ip, port: server.port || 8728,
                user: server.username, password: server.password,
                keepalive: false, timeout: 20
            });

            try {
                await client.connect();
                const existing = await client.write(['/ip/firewall/nat/print', `?comment=${comment}`]);
                if (existing.length > 0) {
                    const cmd = ['/ip/firewall/nat/set', `=.id=${existing[0]['.id']}`];
                    // Comment not updated per user request
                    if (dstPort) cmd.push(`=dst-port=${dstPort}`);
                    if (toAddress) cmd.push(`=to-addresses=${toAddress}`);
                    if (toPorts) cmd.push(`=to-ports=${toPorts}`);
                    await client.write(cmd);
                    await rule.update({ last_check_status: 'online' });
                }
                await client.close();
            } catch (err) {
                console.error('[NAT Update Push] Failed:', err.message);
                await rule.update({ last_check_status: 'offline' });
            }
        }

        res.json({ success: true, rule });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Delete NAT Rule (FROM APP ONLY)
app.delete('/api/mikrotik/nat', async (req, res) => {
    const { serverId, id } = req.body;
    if (!serverId || !id) return res.status(400).json({ error: 'Missing serverId or rule id' });

    try {
        const rule = await RemoteDevice.findByPk(id);
        if (!rule) return res.status(404).json({ error: 'Rule not found' });

        // 1. Delete from DB only
        await rule.destroy();

        // No logic here to delete from Mikrotik per user request

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- Mikrotik Backup / Restore ---

// List backup files on Mikrotik
app.get('/api/mikrotik/backup/files', async (req, res) => {
    const { serverId } = req.query;
    if (!serverId) return res.status(400).json({ error: 'Missing serverId' });

    try {
        const server = await Server.findByPk(serverId);
        if (!server) return res.status(404).json({ error: 'Server not found' });

        const client = new RouterOSAPI({
            host: server.ip, port: server.port || 8728,
            user: server.username, password: server.password,
            keepalive: false, timeout: 20
        });
        client.on('error', (err) => console.error('[Backup List] Error:', err.message));

        await client.connect();
        const files = await client.write(['/file/print']);
        await client.close();

        // Filter backup files (.backup extension)
        const backupFiles = files.filter(f => f.name && f.name.endsWith('.backup'));
        res.json(backupFiles);
    } catch (e) {
        console.error('[Backup List] Failed:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Trigger backup now on Mikrotik
app.post('/api/mikrotik/backup/create', async (req, res) => {
    const { serverId, backupName } = req.body;
    if (!serverId) return res.status(400).json({ error: 'Missing serverId' });

    try {
        const server = await Server.findByPk(serverId);
        if (!server) return res.status(404).json({ error: 'Server not found' });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const name = backupName || `backup-${server.name.replace(/\s+/g, '_')}-${timestamp}`;

        const client = new RouterOSAPI({
            host: server.ip, port: server.port || 8728,
            user: server.username, password: server.password,
            keepalive: false, timeout: 60
        });
        client.on('error', (err) => console.error('[Backup Create] Error:', err.message));

        await client.connect();
        // Create backup with no password (or with password if needed)
        await client.write(['/system/backup/save', `=name=${name}`, '=dont-encrypt=yes']);
        await client.close();

        await logActivity(req, 'MIKROTIK_BACKUP', { serverId, server: server.name, backupName: name });

        res.json({ success: true, fileName: `${name}.backup`, message: `Backup created: ${name}.backup` });
    } catch (e) {
        console.error('[Backup Create] Failed:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Download a backup file from Mikrotik (streams it to client)
app.get('/api/mikrotik/backup/download', async (req, res) => {
    const { serverId, fileName } = req.query;
    if (!serverId || !fileName) return res.status(400).json({ error: 'Missing serverId or fileName' });

    try {
        const server = await Server.findByPk(serverId);
        if (!server) return res.status(404).json({ error: 'Server not found' });

        // Use FTP to download the backup file since RouterOS API doesn't support file download directly
        // We'll use a workaround: read the file via /tool/fetch or direct FTP
        // Since node-routeros doesn't support binary transfer, we use node's net module with FTP
        
        const net = await import('net');
        
        const ftpDownload = () => new Promise((resolve, reject) => {
            const chunks = [];
            let dataSocket = null;
            const controlSocket = new net.default.Socket();

            const send = (cmd) => {
                console.log(`[FTP] C: ${cmd}`);
                controlSocket.write(cmd + '\r\n');
            };

            let step = 0;
            let passivePort = null;
            let passiveHost = null;

            controlSocket.on('data', async (data) => {
                const lines = data.toString().split('\r\n').filter(Boolean);
                for (const line of lines) {
                    console.log(`[FTP] S: ${line}`);
                    const code = parseInt(line.substring(0, 3));

                    if (code === 220 && step === 0) { step++; send(`USER ${server.username}`); }
                    else if (code === 331 && step === 1) { step++; send(`PASS ${server.password}`); }
                    else if (code === 230 && step === 2) { step++; send('TYPE I'); }
                    else if (code === 200 && step === 3) { step++; send('PASV'); }
                    else if (code === 227 && step === 4) {
                        step++;
                        const match = line.match(/\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/);
                        if (!match) { reject(new Error('PASV parse failed')); return; }
                        passiveHost = `${match[1]}.${match[2]}.${match[3]}.${match[4]}`;
                        passivePort = parseInt(match[5]) * 256 + parseInt(match[6]);

                        dataSocket = new net.default.Socket();
                        dataSocket.connect(passivePort, passiveHost, () => {
                            send(`RETR ${fileName}`);
                        });
                        dataSocket.on('data', (chunk) => chunks.push(chunk));
                        dataSocket.on('error', (err) => reject(err));
                    }
                    else if (code === 150 || code === 125) { /* transfer starting */ }
                    else if (code === 226) {
                        // Transfer complete
                        if (dataSocket) dataSocket.destroy();
                        send('QUIT');
                        resolve(Buffer.concat(chunks));
                    }
                    else if (code >= 400) {
                        reject(new Error(`FTP Error: ${line}`));
                    }
                }
            });

            controlSocket.on('error', (err) => reject(err));
            controlSocket.connect(21, server.ip);
        });

        const fileBuffer = await ftpDownload();
        
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Length', fileBuffer.length);
        res.send(fileBuffer);

        await logActivity(req, 'MIKROTIK_BACKUP_DOWNLOAD', { serverId, server: server.name, fileName });

    } catch (e) {
        console.error('[Backup Download] Failed:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Upload backup file and restore on Mikrotik
app.post('/api/mikrotik/backup/restore', upload.single('backupFile'), async (req, res) => {
    const { serverId } = req.body;
    if (!serverId) return res.status(400).json({ error: 'Missing serverId' });
    if (!req.file) return res.status(400).json({ error: 'No backup file uploaded' });

    const uploadedPath = req.file.path;

    try {
        const server = await Server.findByPk(serverId);
        if (!server) {
            fs.unlinkSync(uploadedPath);
            return res.status(404).json({ error: 'Server not found' });
        }

        const fileName = req.file.originalname;
        const fileBuffer = fs.readFileSync(uploadedPath);

        // Upload file to Mikrotik via FTP, then trigger restore
        const net = await import('net');
        
        const ftpUpload = () => new Promise((resolve, reject) => {
            const controlSocket = new net.default.Socket();
            let dataSocket = null;
            let step = 0;

            const send = (cmd) => {
                console.log(`[FTP Upload] C: ${cmd}`);
                controlSocket.write(cmd + '\r\n');
            };

            controlSocket.on('data', (data) => {
                const lines = data.toString().split('\r\n').filter(Boolean);
                for (const line of lines) {
                    console.log(`[FTP Upload] S: ${line}`);
                    const code = parseInt(line.substring(0, 3));

                    if (code === 220 && step === 0) { step++; send(`USER ${server.username}`); }
                    else if (code === 331 && step === 1) { step++; send(`PASS ${server.password}`); }
                    else if (code === 230 && step === 2) { step++; send('TYPE I'); }
                    else if (code === 200 && step === 3) { step++; send('PASV'); }
                    else if (code === 227 && step === 4) {
                        step++;
                        const match = line.match(/\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/);
                        if (!match) { reject(new Error('PASV parse failed')); return; }
                        const host = `${match[1]}.${match[2]}.${match[3]}.${match[4]}`;
                        const port = parseInt(match[5]) * 256 + parseInt(match[6]);

                        dataSocket = new net.default.Socket();
                        dataSocket.connect(port, host, () => {
                            dataSocket.write(fileBuffer);
                            dataSocket.end();
                            send(`STOR ${fileName}`);
                        });
                        dataSocket.on('error', (err) => reject(err));
                    }
                    else if (code === 150 || code === 125) { /* upload starting */ }
                    else if (code === 226) {
                        send('QUIT');
                        resolve(true);
                    }
                    else if (code >= 400) {
                        reject(new Error(`FTP Error: ${line}`));
                    }
                }
            });

            controlSocket.on('error', (err) => reject(err));
            controlSocket.connect(21, server.ip);
        });

        await ftpUpload();
        fs.unlinkSync(uploadedPath);

        // Now trigger restore on Mikrotik via API
        const restoreName = fileName.replace('.backup', '');
        const client = new RouterOSAPI({
            host: server.ip, port: server.port || 8728,
            user: server.username, password: server.password,
            keepalive: false, timeout: 60
        });
        client.on('error', (err) => console.error('[Backup Restore] Error:', err.message));

        await client.connect();
        await client.write(['/system/backup/load', `=name=${restoreName}`, '=dont-encrypt=yes']);
        // Note: router will reboot after this, connection will drop
        try { await client.close(); } catch (_) {}

        await logActivity(req, 'MIKROTIK_RESTORE', { serverId, server: server.name, fileName });

        res.json({ success: true, message: `Restore initiated from ${fileName}. Router will reboot.` });
    } catch (e) {
        console.error('[Backup Restore] Failed:', e.message);
        try { if (fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath); } catch (_) {}
        res.status(500).json({ error: e.message });
    }
});

// --- ONU Change Endpoints ---

// List PPP Secrets for a server
app.get('/api/mikrotik/secrets/:serverId', async (req, res) => {
    const { serverId } = req.params;
    try {
        const server = await Server.findByPk(serverId);
        if (!server) return res.status(404).json({ error: 'Server not found' });

        const client = new RouterOSAPI({
            host: server.ip, port: server.port || 8728,
            user: server.username, password: server.password,
            keepalive: false, timeout: 20
        });

        await client.connect();
        const secrets = await client.write('/ppp/secret/print');
        await client.close();

        res.json(secrets);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Delete a backup file from Mikrotik via FTP
app.delete('/api/mikrotik/backup/delete', async (req, res) => {
    const { serverId, fileName } = req.body;
    if (!serverId || !fileName) return res.status(400).json({ error: 'Missing serverId or fileName' });
    try {
        const server = await Server.findByPk(serverId);
        if (!server) return res.status(404).json({ error: 'Server not found' });
        const net = await import('net');
        const ftpDelete = () => new Promise((resolve, reject) => {
            const controlSocket = new net.default.Socket();
            let step = 0;
            const send = (cmd) => { controlSocket.write(cmd + '\r\n'); };
            controlSocket.on('data', (data) => {
                const lines = data.toString().split('\r\n').filter(Boolean);
                for (const line of lines) {
                    const code = parseInt(line.substring(0, 3));
                    if (code === 220 && step === 0) { step++; send(`USER ${server.username}`); }
                    else if (code === 331 && step === 1) { step++; send(`PASS ${server.password}`); }
                    else if (code === 230 && step === 2) { step++; send('TYPE I'); }
                    else if (code === 200 && step === 3) { step++; send(`DELE ${fileName}`); }
                    else if (code === 250) { resolve(true); }
                    else if (code >= 400) { reject(new Error(`FTP Error: ${line}`)); }
                }
            });
            controlSocket.on('error', (err) => reject(err));
            controlSocket.connect(21, server.ip);
        });
        await ftpDelete();
        await logActivity(req, 'MIKROTIK_BACKUP_DELETE', { serverId, server: server.name, fileName });
        res.json({ success: true, message: `Backup ${fileName} deleted` });
    } catch (e) {
        console.error('[Backup Delete] Failed:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Update PPP Secret
app.put('/api/mikrotik/secrets', async (req, res) => {
    const { serverId, name, password, comment, profile } = req.body;
    if (!serverId || !name) return res.status(400).json({ error: 'Missing serverId or name' });

    try {
        const server = await Server.findByPk(serverId);
        if (!server) return res.status(404).json({ error: 'Server not found' });

        const client = new RouterOSAPI({
            host: server.ip, port: server.port || 8728,
            user: server.username, password: server.password,
            keepalive: false, timeout: 20
        });

        await client.connect();
        
        // Find ID by name
        const existing = await client.write(['/ppp/secret/print', `?name=${name}`]);
        if (existing.length === 0) {
            await client.close();
            return res.status(404).json({ error: `Secret ${name} not found` });
        }

        const cmd = ['/ppp/secret/set', `=.id=${existing[0]['.id']}`];
        if (password !== undefined) cmd.push(`=password=${password}`);
        if (comment !== undefined) cmd.push(`=comment=${comment}`);
        if (profile !== undefined) cmd.push(`=profile=${profile}`);

        await client.write(cmd);
        await client.close();

        res.json({ success: true, message: 'Secret updated successfully' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Change ONU Logic
app.post('/api/mikrotik/change-onu', async (req, res) => {
    const { serverId, oldUsername, newUsername, user } = req.body;
    if (!serverId || !oldUsername || !newUsername) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const server = await Server.findByPk(serverId);
        if (!server) return res.status(404).json({ error: 'Server not found' });

        const client = new RouterOSAPI({
            host: server.ip, port: server.port || 8728,
            user: server.username, password: server.password,
            keepalive: false, timeout: 60
        });

        // Prevention for "Uncaught Exception" crash
        client.on('error', (err) => {
            console.error(`[Change ONU] Mikrotik Error (${server.ip}):`, err.message);
        });

        let oldComment = '';
        try {
            await client.connect();

            const delay = (ms) => new Promise(res => setTimeout(res, ms));

            // 1. Fetch old ppp secret
            const oldSecrets = await client.write(['/ppp/secret/print', `?name=${oldUsername}`]);
            if (oldSecrets.length === 0) {
                await client.close();
                return res.status(404).json({ error: `PPP secret ${oldUsername} not found on router` });
            }
            const oldSecret = oldSecrets[0];
            const oldProfile = oldSecret.profile;
            oldComment = oldSecret.comment || '';

            await delay(200);

            // 2. Fetch new ppp secret
            const newSecrets = await client.write(['/ppp/secret/print', `?name=${newUsername}`]);
            if (newSecrets.length === 0) {
                await client.close();
                return res.status(404).json({ error: `PPP secret ${newUsername} not found on router` });
            }
            const newSecret = newSecrets[0];

            await delay(200);

            // 3. Update NEW secret
            await client.write([
                '/ppp/secret/set',
                `=.id=${newSecret['.id']}`,
                `=profile=${oldProfile}`,
                `=comment=${oldComment}`
            ]);

            await delay(200);

            // 4. Update OLD secret
            await client.write([
                '/ppp/secret/set',
                `=.id=${oldSecret['.id']}`,
                `=profile=BELUM AKTIF`,
                `=comment=${oldUsername}`
            ]);

            await delay(200);

            // 5. Kick old session
            const activeSessions = await client.write(['/ppp/active/print', `?name=${oldUsername}`]);
            if (activeSessions.length > 0) {
                for (const session of activeSessions) {
                    try {
                        await client.write(['/ppp/active/remove', `=.id=${session['.id']}`]);
                        await delay(100);
                    } catch (err) {
                        console.warn(`[Change ONU] Failed to remove session ${session['.id']}:`, err.message);
                    }
                }
            }

            await delay(200);
            await client.close();
        } catch (mErr) {
            // Attempt to close if still connected
            try { await client.close(); } catch(ce) {}
            throw mErr; // Re-throw to be caught by outer try-catch
        }

        // 6. Record in DB Log
        await OnuChangeLog.create({
            server_id: serverId,
            old_username: oldUsername,
            new_username: newUsername,
            old_comment: oldComment,
            user_name: user?.username || 'Unknown'
        });

        // 7. Update SQL Customer table
        // We find the source customer (old device)
        const oldCustomer = await Customer.findOne({ 
            where: { 
                server_id: serverId, 
                mikrotik_name: String(oldUsername).toLowerCase().trim() 
            } 
        });

        if (oldCustomer) {
            const newLower = String(newUsername).toLowerCase().trim();
            
            // Check if there's already a record for the new username (e.g. from a previous sync)
            const existingNew = await Customer.findOne({
                where: { server_id: serverId, mikrotik_name: newLower }
            });

            if (existingNew && existingNew.id !== oldCustomer.id) {
                console.log(`[Change ONU] Deleting existing placeholder for ${newLower} (ID: ${existingNew.id})`);
                await existingNew.destroy();
            }

            // Rename the old record to the new username
            await oldCustomer.update({ mikrotik_name: newLower });

            // 8. Update JSON Cache (Metadata)
            // This is crucial for real_name, address, etc. if they are stored in JSON
            const oldKey = `${String(serverId).toLowerCase()}-${String(oldUsername).toLowerCase().trim()}`;
            const newKey = `${String(serverId).toLowerCase()}-${newLower}`;

            if (CACHE.customers && CACHE.customers[oldKey]) {
                console.log(`[Change ONU] Moving JSON metadata from ${oldKey} to ${newKey}`);
                CACHE.customers[newKey] = {
                    ...(CACHE.customers[newKey] || {}),
                    ...CACHE.customers[oldKey]
                };
                delete CACHE.customers[oldKey];
                queueWrite('customers', CACHE.customers);
            }
        }

        logActivity(req, 'CHANGE_ONU', `Changed ONU for ${oldUsername} to ${newUsername} on server ${server.name}`);

        res.json({ success: true, message: 'ONU Changed successfully' });
    } catch (e) {
        console.error('[Change ONU] Final Error:', e);
        res.status(500).json({ error: e.message || 'Unknown error occurred during ONU change' });
    }
});

// Get ONU Change Logs
app.get('/api/mikrotik/onu-logs', async (req, res) => {
    try {
        const logs = await OnuChangeLog.findAll({
            include: [Server],
            order: [['timestamp', 'DESC']]
        });
        res.json(logs);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- CRM Endpoints ---

// [NEW] Update Customer CRM Data directly (Bypass Mikrotik Sync)
app.put('/api/customers/:id', async (req, res) => {
    const { id } = req.params;
    console.log(`[DEBUG] PUT /api/customers/${id} called`);
    console.log('[DEBUG] Body:', JSON.stringify(req.body));
    const { 
        name, realName, whatsapp, address, photos, sub_area_id, ktp, activationDate, coordinates,
        installationDate, ssidName, ssidPassword, signalLevel
    } = req.body;

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    
    try {
        let customer;
        // 1. Try finding by UUID (if id is a valid UUID)
        try {
            if (id && id.length > 20) { // Simple UUID check
                customer = await Customer.findByPk(id);
            }
        } catch (e) { }

        // 2. Fallback: Find by Mikrotik Name + Server ID (if passed in body)
        // Frontend likely passes Mikrotik ID (*xx) as :id, so lookup by name/server is safer.
        if (!customer && req.body.serverId && (req.body.name || req.body.username)) {
            const serverId = req.body.serverId;
            const mikrotikName = req.body.name || req.body.username;

            customer = await Customer.findOne({
                where: {
                    server_id: serverId,
                    mikrotik_name: String(mikrotikName).toLowerCase().trim()
                }
            });

            // If still not found, try to Create it?
            // "App Data" save implies we want to attach data to this user.
            // If the user exists in Mikrotik (which they should if we are editing),
            // but not in SQL, we should create the SQL record now.
            if (!customer) {
                console.log(`[CRM] Customer ${mikrotikName} not found in SQL. Creating...`);
                customer = await Customer.create({
                    mikrotik_name: mikrotikName,
                    server_id: serverId,
                    real_name: realName || mikrotikName,
                    status: 'active'
                });
            }
        }

        if (!customer) {
            console.log(`[DEBUG] Customer lookup failed for ID: ${id}, ServerID: ${req.body.serverId}, Name: ${req.body.name}`);
            return res.status(404).json({ error: 'Customer not found (SQL Lookup Failed)' });
        }

        // Update SQL fields
        await customer.update({
            // Explicitly separate Mikrotik account and Real Name
            real_name: realName ?? customer.real_name, 
            phone_number: whatsapp ?? customer.phone_number,
            address: address ?? customer.address,
            sub_area_id: sub_area_id ?? customer.sub_area_id,
            ktp: ktp ?? customer.ktp,
            coordinates: coordinates ?? customer.coordinates,
            activationDate: (activationDate || installationDate) ?? customer.activationDate,
            installationDate: (installationDate || activationDate) ?? customer.installationDate,
            photos: photos ?? customer.photos,
            ssidName: ssidName ?? customer.ssidName,
            ssidPassword: ssidPassword ?? customer.ssidPassword,
            signalLevel: signalLevel ?? customer.signalLevel
        });

        // Also update JSON metadata (customers.json) for immediate frontend consistency
        const db = getDB();
        const key = `${String(customer.server_id).toLowerCase()}-${String(customer.mikrotik_name).toLowerCase().trim()}`;
        
        db[key] = {
            ...(db[key] || {}),
            whatsapp,
            realName: realName || name,
            address,
            sub_area_id,
            coordinates,
            lat: coordinates?.includes(',') ? coordinates.split(',')[0].trim() : (db[key]?.lat || ''),
            long: coordinates?.includes(',') ? coordinates.split(',')[1].trim() : (db[key]?.long || ''),
            ktp,
            activationDate,
            installationDate,
            photos,
            ssidName,
            ssidPassword,
            signalLevel
        };
        saveDB(db);

        res.json({ message: 'Customer updated successfully', customer });
    } catch (error) {
        console.error('Error updating customer:', error);
        res.status(500).json({ error: 'Failed to update customer' });
    }
});

// --- CRM Endpoints (SQL) ---


// Get All Meta Data (Formatted as Map for Frontend Compatibility)
app.get('/api/customers/meta', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    try {
        const sqlCustomers = await Customer.findAll();
        const jsonMetadata = CACHE.customers || {};
        
        // Start with JSON data as base
        const metaMap = { ...jsonMetadata };
        
        // Overwrite/Merge with SQL data
        sqlCustomers.forEach(c => {
            const key = `${String(c.server_id).toLowerCase()}-${String(c.mikrotik_name).toLowerCase().trim()}`;
            const sqlData = c.toJSON();
            
            // 3. Map SQL field names to CRM field names (Avoid overlap with account 'name' or 'id')
            const { name: sqlRealName, id: sqlId, ...otherSqlFields } = sqlData;
            
            metaMap[key] = {
                ...(metaMap[key] || {}), // Base data from JSON if any
                ...otherSqlFields,       // Overwrite with other SQL fields (address, ktp, etc.)
                crmId: sqlId,            // Save SQL ID separately as crmId
                // Explicit Mapping to prevent confusion
                realName: sqlData.real_name || metaMap[key]?.realName || '',
                whatsapp: sqlData.phone_number || metaMap[key]?.whatsapp || '',
                lat: sqlData.coordinates?.split(',')[0]?.trim() || metaMap[key]?.lat || '',
                long: sqlData.coordinates?.split(',')[1]?.trim() || metaMap[key]?.long || '',
                address: sqlData.address || metaMap[key]?.address || '',
                ktp: sqlData.ktp || metaMap[key]?.ktp || '',
                sub_area_id: sqlData.sub_area_id || metaMap[key]?.sub_area_id || '',
                activationDate: sqlData.activationDate || metaMap[key]?.activationDate || '',
                installationDate: sqlData.installationDate || metaMap[key]?.installationDate || '',
                ssidName: sqlData.ssidName || metaMap[key]?.ssidName || '',
                ssidPassword: sqlData.ssidPassword || metaMap[key]?.ssidPassword || '',
                signalLevel: sqlData.signalLevel || metaMap[key]?.signalLevel || '',
                photos: Array.isArray(sqlData.photos) ? sqlData.photos : (metaMap[key]?.photos || [])
            };
            // Clean up the 'name' field if it accidentally came from JSON but it's empty in SQL
            if (metaMap[key].name === metaMap[key].realName) {
                 // name should represent Username, realName should be the actual name.
            }
        });
        
        res.json(metaMap);
    } catch (e) {
        console.error('[Meta] Failed to fetch metadata:', e);
        res.status(500).json({ error: e.message });
    }
});

// Update/Create Meta Data for a Customer
app.post('/api/customers/meta', async (req, res) => {
    const { serverId, customerId, ...metaData } = req.body;

    if (!serverId || !customerId) {
        return res.status(400).json({ error: 'Missing Identity' });
    }

    try {
        // Map frontend 'whatsapp' to SQL 'phone_number'
        const sqlPayload = {
            ...metaData,
            phone_number: metaData.whatsapp || metaData.phone_number,
            name: metaData.realName || metaData.name
        };

        let customer = await Customer.findOne({
            where: { server_id: serverId, mikrotik_name: String(customerId).toLowerCase().trim() }
        });

        if (customer) {
            await customer.update(sqlPayload);
        } else {
            customer = await Customer.create({
                server_id: serverId,
                mikrotik_name: String(customerId).toLowerCase().trim(),
                ...sqlPayload,
                status: 'active'
            });
        }

        // Also update JSON Cache for immediate consistency
        const key = `${String(serverId).toLowerCase()}-${String(customerId).toLowerCase().trim()}`;
        CACHE.customers[key] = {
            ...(CACHE.customers[key] || {}),
            ...metaData,
        };
        queueWrite('customers', CACHE.customers);

        logActivity(req, 'UPDATE_CUSTOMER_META', `Updated meta for ${customerId}`);
        res.json({ success: true, data: customer });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// Bulk Delete Customers (App DB only — does NOT touch Mikrotik)
// Deletes by crmId (SQL UUID). Cascade removes linked invoices & payments.
app.post('/api/customers/bulk-delete', async (req, res) => {
    const { customerIds } = req.body;
    if (!Array.isArray(customerIds) || customerIds.length === 0) {
        return res.status(400).json({ error: 'Missing or empty customerIds array' });
    }

    try {
        const deleted = await Customer.destroy({
            where: { id: { [Op.in]: customerIds } }
        });

        logActivity(req, 'BULK_DELETE_CUSTOMERS', `Deleted ${deleted} customer records from app DB (IDs: ${customerIds.join(', ')})`);
        res.json({ success: true, deleted, message: `${deleted} customer record(s) deleted from app database.` });
    } catch (e) {
        console.error('[BulkDelete] Customer error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// --- Billing Endpoints ---

// Get Invoices (Optional filter by customer)
// Get Invoices (Filter by customer, status, period, server, search, pagination)
app.get('/api/billing/invoices', async (req, res) => {
    try {
        const {
            customerId,
            status,
            search,
            period,
            serverId,
            subAreaId,
            paymentDate,
            page = 1,
            limit = 50,
            sortBy,
            order = 'ASC'
        } = req.query;

        const offset = (Number(page) - 1) * Number(limit);
        const whereInvoice = {};

        // Invoice Filters
        if (customerId) whereInvoice.customer_id = customerId;
        if (status) whereInvoice.status = status;
        if (period) whereInvoice.period = period;
        // Invoices also store server_id, so we can filter directly or via Customer
        if (serverId) whereInvoice.server_id = serverId;

        const includeCustomer = {
            model: Customer,
            required: true,
            where: {},
            include: [{ model: Server, required: false }] // Include server info for display
        };

        if (subAreaId) {
            whereInvoice['$Customer.sub_area_id$'] = subAreaId;
        }

        if (search) {
            whereInvoice[Op.or] = [
                { '$Customer.mikrotik_name$': { [Op.like]: `%${search}%` } }, // PPP Secret name (username)
                { '$Customer.comment$': { [Op.like]: `%${search}%` } },        // PPP Secret comment (customer label)
                { '$Customer.real_name$': { [Op.like]: `%${search}%` } },      // Real name from app DB
                { '$Customer.name$': { [Op.like]: `%${search}%` } },
                { '$Customer.profile$': { [Op.like]: `%${search}%` } },        // Profile/Daya
                { period: { [Op.like]: `%${search}%` } },
                { status: { [Op.like]: `%${search}%` } }
            ];
            
            if (!isNaN(search) && String(search).trim() !== '') {
                whereInvoice[Op.or].push({ amount: search });
            }
        }

        // Sorting Logic
        let orderClause = [['generated_at', 'DESC']];
        if (sortBy) {
            const dir = String(order).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
            if (sortBy === 'customer_name') {
                orderClause = [[Customer, 'name', dir]];
            } else if (sortBy === 'username') {
                orderClause = [[Customer, 'mikrotik_name', dir]];
            } else if (sortBy === 'profile') {
                orderClause = [[Customer, 'profile', dir]];
            } else if (['period', 'due_date', 'amount', 'status'].includes(sortBy)) {
                orderClause = [[sortBy, dir]];
            }
        }

        const includePayment = { model: Payment, required: false };
        if (paymentDate) {
            // paymentDate is expected as YYYY-MM-DD
            const startDate = new Date(paymentDate);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 1);

            includePayment.where = {
                transaction_date: {
                    [Op.gte]: startDate,
                    [Op.lt]: endDate
                }
            };
            includePayment.required = true; // Must have payment on this date to show up
        }

        const { count, rows } = await Invoice.findAndCountAll({
            where: whereInvoice,
            include: [includeCustomer, includePayment],
            order: orderClause,
            limit: Number(limit),
            offset: Number(offset),
            subQuery: false
        });

        res.json({
            data: rows,
            meta: {
                total: count,
                page: Number(page),
                totalPages: Math.ceil(count / Number(limit)),
                limit: Number(limit)
            }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get Billing Analytics
// Get Billing Analytics
app.get('/api/billing/analytics', async (req, res) => {
    try {
        const { period, serverId, dailyRange, monthlyRange } = req.query;

        // Base where for filtering by server
        const baseWhere = {};
        if (serverId) baseWhere.server_id = serverId;

        // Helper to calculate start period
        const getStartPeriod = (endP, months) => {
            if (!endP) return null;
            const [y, m] = endP.split('-').map(Number);
            const date = new Date(y, m - 1, 1);
            date.setMonth(date.getMonth() - (months - 1));
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        };

        // 1. Fetch Summary Data (Strictly for the selected period)
        const summaryWhere = { ...baseWhere };
        if (period) summaryWhere.period = period;
        
        const summaryInvoices = await Invoice.findAll({
            where: summaryWhere,
            include: [
                { model: Payment },
                { model: Customer }
            ]
        });

        // Map server UUIDs to names
        const servers = await Server.findAll();
        const serverMap = {};
        for(const s of servers) serverMap[s.id] = s.name;

        let totalPaid = 0;
        let totalUnpaid = 0;
        let paidCount = 0;
        let unpaidCount = 0;
        const revenueByServerMap = {};
        const methodStatsMap = {};
        const anomalies = [];

        for (const inv of summaryInvoices) {
            const isPaid = inv.status === 'PAID';
            const hasPayments = inv.Payments && inv.Payments.length > 0;
            const amount = Number(inv.amount) || 0;
            const serverName = serverMap[inv.server_id] || inv.server_id || 'Unknown';

            if (!revenueByServerMap[serverName]) {
                revenueByServerMap[serverName] = { 
                    amount: 0, count: 0, 
                    unpaidAmount: 0, unpaidCount: 0,
                    invoices: [] 
                };
            }
            
            if (isPaid) {
                paidCount++;
                totalPaid += amount;
                revenueByServerMap[serverName].amount += amount;
                revenueByServerMap[serverName].count++;
                revenueByServerMap[serverName].invoices.push(inv);

                let method = 'unknown';
                if (hasPayments) {
                    method = inv.Payments[0].method || 'unknown';
                }
                if (!methodStatsMap[method]) methodStatsMap[method] = { amount: 0, count: 0, invoices: [] };
                methodStatsMap[method].amount += amount;
                methodStatsMap[method].count++;
                methodStatsMap[method].invoices.push(inv);
            } else if (inv.status === 'UNPAID') {
                unpaidCount++;
                totalUnpaid += amount;
                
                revenueByServerMap[serverName].unpaidAmount += amount;
                revenueByServerMap[serverName].unpaidCount++;
                revenueByServerMap[serverName].invoices.push(inv);
            }
        }

        // 2. Fetch Daily Revenue (Based on dailyRange)
        const dailyWhere = { ...baseWhere, status: 'PAID' };
        if (period) {
            if (dailyRange === '1w' || dailyRange === '2w' || dailyRange === '1m') {
                // For daily within a month or two, we just filter by the period
                // (Assuming period is like '2025-05')
                dailyWhere.period = period; 
            } else if (dailyRange === '1y') {
                const startP = getStartPeriod(period, 12);
                dailyWhere.period = { [Op.between]: [startP, period] };
            } else {
                dailyWhere.period = period;
            }
        }

        const dailyInvoices = await Invoice.findAll({
            where: dailyWhere,
            include: [{ model: Payment, required: true }]
        });

        const dailyStatsMap = {};
        for (const inv of dailyInvoices) {
            for (const p of inv.Payments) {
                const dateStr = p.transaction_date ? new Date(p.transaction_date).toISOString().split('T')[0] : 'Unknown';
                if (dateStr !== 'Unknown') {
                    if (!dailyStatsMap[dateStr]) dailyStatsMap[dateStr] = 0;
                    dailyStatsMap[dateStr] += Number(inv.amount);
                }
            }
        }
        const dailyRevenue = Object.keys(dailyStatsMap).sort().map(k => ({ date: k, amount: dailyStatsMap[k] }));

        // 3. Fetch Monthly Trend (Based on monthlyRange)
        const monthlyWhere = { ...baseWhere };
        if (period) {
            if (monthlyRange === 'all') {
                // No period filter
            } else {
                const months = monthlyRange === '6m' ? 6 : monthlyRange === '1y' ? 12 : 3;
                const startP = getStartPeriod(period, months);
                monthlyWhere.period = { [Op.between]: [startP, period] };
            }
        }

        const monthlyInvoices = await Invoice.findAll({
            where: monthlyWhere,
            attributes: ['period', 'status', 'amount']
        });

        const monthlyStatsMap = {};
        for (const inv of monthlyInvoices) {
            const p = inv.period || 'Unknown';
            if (!monthlyStatsMap[p]) monthlyStatsMap[p] = { PAID: 0, UNPAID: 0, CANCELLED: 0, INVALID: 0 };
            const status = inv.status || 'UNPAID';
            const amt = Number(inv.amount) || 0;
            if (monthlyStatsMap[p][status] !== undefined) monthlyStatsMap[p][status] += amt;
        }
        const monthlyTrend = Object.keys(monthlyStatsMap).sort().map(k => ({ period: k, ...monthlyStatsMap[k] }));

        res.json({
            summary: {
                totalPaid,
                totalUnpaid,
                paidCount,
                unpaidCount,
                totalRevenue: totalPaid
            },
            revenueByServer: Object.keys(revenueByServerMap).map(k => ({ name: k, ...revenueByServerMap[k] })),
            revenueByMethod: Object.keys(methodStatsMap).map(k => ({ name: k, ...methodStatsMap[k] })),
            dailyRevenue,
            monthlyTrend,
            anomalies
        });

    } catch (e) {
        console.error('Analytics Error:', e);
        res.status(500).json({ error: e.message });
    }
});


// Get Payment Recap (Filter by customer, period, server, search, pagination)
app.get('/api/billing/payments', async (req, res) => {
    try {
        const {
            search,
            period,
            serverId,
            subAreaId,
            paymentDate,
            page = 1,
            limit = 50,
            sortBy,
            order = 'DESC'
        } = req.query;

        const offset = (Number(page) - 1) * Number(limit);
        
        // Build Invoice Filters (to filter by period and server)
        const whereInvoice = {};
        if (period) whereInvoice.period = period;
        if (serverId) whereInvoice.server_id = serverId;

        // Build Customer Filters (to search by name)
        const whereCustomer = {};
        const wherePayment = {};

        if (subAreaId) {
            wherePayment['$Invoice.Customer.sub_area_id$'] = subAreaId;
        }
        if (paymentDate) {
            const startDate = new Date(paymentDate);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 1);
            wherePayment.transaction_date = {
                [Op.gte]: startDate,
                [Op.lt]: endDate
            };
        }

        if (search) {
            wherePayment[Op.or] = [
                { '$Invoice.Customer.mikrotik_name$': { [Op.like]: `%${search}%` } }, // PPP Secret: name (username)
                { '$Invoice.Customer.comment$': { [Op.like]: `%${search}%` } },        // PPP Secret: comment (customer label)
                { '$Invoice.Customer.real_name$': { [Op.like]: `%${search}%` } },      // Real name dari DB app
                { '$Invoice.Customer.name$': { [Op.like]: `%${search}%` } },
                { '$Invoice.Customer.profile$': { [Op.like]: `%${search}%` } },        // Profile/Daya
                { '$Invoice.period$': { [Op.like]: `%${search}%` } },
                { method: { [Op.like]: `%${search}%` } }
            ];
            
            if (!isNaN(search) && String(search).trim() !== '') {
                wherePayment[Op.or].push({ amount: search });
            }
        }

        let orderClause = [['transaction_date', 'DESC']];
        if (sortBy) {
            const dir = String(order).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
            if (sortBy === 'customer_name') {
                orderClause = [[Invoice, Customer, 'name', dir]];
            } else if (sortBy === 'username') {
                orderClause = [[Invoice, Customer, 'mikrotik_name', dir]];
            } else if (sortBy === 'period') {
                orderClause = [[Invoice, 'period', dir]];
            } else if (sortBy === 'profile') {
                orderClause = [[Invoice, Customer, 'profile', dir]];
            } else if (['amount', 'method', 'transaction_date'].includes(sortBy)) {
                orderClause = [[sortBy, dir]];
            }
        }

        const { count, rows } = await Payment.findAndCountAll({
            where: wherePayment,
            include: [
                {
                    model: Invoice,
                    required: true,
                    where: whereInvoice,
                    include: [{
                        model: Customer,
                        required: true,
                        where: whereCustomer,
                        include: [Server]
                    }]
                }
            ],
            order: orderClause,
            limit: Number(limit) > 0 ? Number(limit) : undefined,
            offset: Number(offset) > 0 ? Number(offset) : 0,
            subQuery: false
        });

        res.json({
            data: rows,
            meta: {
                total: count,
                page: Number(page),
                totalPages: limit > 0 ? Math.ceil(count / Number(limit)) : 1,
                limit: Number(limit)
            }
        });
    } catch (e) {
        console.error('Failed to fetch payments:', e);
        res.status(500).json({ error: e.message });
    }
});

// Bulk Delete Invoices (Superadmin only)
app.post('/api/billing/bulk-delete', async (req, res) => {
    const { invoiceIds, user } = req.body;

    if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) {
        return res.status(403).json({ error: 'Access denied. Authorized users only.' });
    }

    if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
        return res.status(400).json({ error: 'No invoices selected' });
    }

    try {
        // Safe Delete: Remove related records first (in case CASCADE is not synced yet or fails)
        await Payment.destroy({ where: { invoice_id: invoiceIds } });
        await InvoiceHistory.destroy({ where: { invoice_id: invoiceIds } });

        await Invoice.destroy({ where: { id: invoiceIds } });
        logActivity(req, 'BULK_DELETE_INVOICES', `Deleted ${invoiceIds.length} invoices: ${invoiceIds.join(', ')}`);
        console.log(`[Billing] Bulk delete of ${invoiceIds.length} invoices by ${user.username}`);
        res.json({ success: true, message: `Deleted ${invoiceIds.length} invoices` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// Bulk Delete Payments (Superadmin only)
app.post('/api/billing/payments/bulk-delete', async (req, res) => {
    const { paymentIds, user } = req.body;

    if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) {
        return res.status(403).json({ error: 'Access denied. Authorized users only.' });
    }

    if (!Array.isArray(paymentIds) || paymentIds.length === 0) {
        return res.status(400).json({ error: 'No payments selected' });
    }

    try {
        await Payment.destroy({ where: { id: paymentIds } });
        logActivity(req, 'BULK_DELETE_PAYMENTS', `Deleted ${paymentIds.length} payments: ${paymentIds.join(', ')}`);
        console.log(`[Billing] Bulk delete of ${paymentIds.length} payments by ${user.username}`);
        res.json({ success: true, message: `Deleted ${paymentIds.length} payments` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Bulk Update Invoices
app.post('/api/billing/bulk-update', async (req, res) => {
    const { invoiceIds, status, user } = req.body;

    if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) {
        return res.status(403).json({ error: 'Access denied. Authorized users only.' });
    }

    if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
        return res.status(400).json({ error: 'No invoices selected' });
    }

    if (!['PAID', 'UNPAID', 'INVALID', 'CANCELLED'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    try {
        await Invoice.update(
            { status: status },
            { where: { id: invoiceIds } }
        );

        // Individual Log History per invoice
        for (const id of invoiceIds) {
            await InvoiceHistory.create({
                invoice_id: id,
                user_name: req.body.user?.username || 'System',
                action: 'STATUS_UPDATE',
                details: `Status bulk updated to ${status}`
            });
        }

        logActivity(req, 'BULK_UPDATE_INVOICES', `Updated ${invoiceIds.length} invoices to ${status}`);
        res.json({ success: true, message: `Updated ${invoiceIds.length} invoices to ${status}` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Bulk Update Payment Methods (Superadmin only)
app.post('/api/billing/bulk-method', async (req, res) => {
    const { invoiceIds, paymentIds, method, user } = req.body;

    if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Access denied. Superadmin only.' });
    }

    if (!method) {
        return res.status(400).json({ error: 'No payment method specified' });
    }

    try {
        let targetPaymentIds = [];
        let targetInvoiceIds = [];

        if (Array.isArray(paymentIds) && paymentIds.length > 0) {
            targetPaymentIds = paymentIds;
            const payments = await Payment.findAll({ where: { id: paymentIds }, attributes: ['invoice_id'] });
            targetInvoiceIds = [...new Set(payments.map(p => p.invoice_id))];
        } else if (Array.isArray(invoiceIds) && invoiceIds.length > 0) {
            targetInvoiceIds = invoiceIds;
            const payments = await Payment.findAll({ where: { invoice_id: invoiceIds }, attributes: ['id'] });
            targetPaymentIds = payments.map(p => p.id);
        } else {
            return res.status(400).json({ error: 'No items selected' });
        }

        if (targetPaymentIds.length > 0) {
            await Payment.update(
                { method: method },
                { where: { id: targetPaymentIds } }
            );
        }
        
        for (const id of targetInvoiceIds) {
            await InvoiceHistory.create({
                invoice_id: id,
                user_name: user.username || 'System',
                action: 'EDIT',
                details: `Payment method bulk updated to ${method}`
            });
        }

        logActivity(req, 'BULK_UPDATE_PAYMENT_METHOD', `Updated method to ${method} for ${targetPaymentIds.length} payments`);
        res.json({ success: true, message: `Updated ${targetPaymentIds.length} items to ${method}` });
    } catch (e) {
        console.error('[Bulk-Method] Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Bulk Block Customers from Invoices
app.post('/api/billing/bulk-block', async (req, res) => {
    const { invoiceIds, user, actionType } = req.body;

    if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) {
        return res.status(403).json({ error: 'Access denied. Authorized users only.' });
    }

    if (!invoiceIds || !Array.isArray(invoiceIds)) return res.status(400).json({ error: 'Invalid invoiceIds' });

    try {
        const invoices = await Invoice.findAll({
            where: { id: invoiceIds },
            include: [{ model: Customer, include: [{ model: Server }] }]
        });

        const serverGroups = {};
        invoices.forEach(inv => {
            const customer = inv.Customer;
            if (customer && customer.Server) {
                const serverId = customer.Server.id;
                if (!serverGroups[serverId]) {
                    serverGroups[serverId] = { server: customer.Server, customers: new Map() };
                }
                serverGroups[serverId].customers.set(customer.id, customer);
            }
        });

        let blockedCount = 0;
        let errors = [];

        for (const serverId in serverGroups) {
            const { server, customers } = serverGroups[serverId];
            const client = new RouterOSAPI({
                host: server.ip,
                port: server.port || 8728,
                user: server.username,
                password: server.password,
                timeout: 30
            });

            client.on('error', (err) => {
                console.error(`[Bulk-Block] Mikrotik Error (${server.ip}):`, err.message);
            });

            try {
                await client.connect();

                // Optimization: Fetch all active sessions once per server to allow case-insensitive lookup
                let allActiveSessions = [];
                if (!actionType || actionType === 'kick') {
                    try {
                        allActiveSessions = await client.write(['/ppp/active/print']);
                    } catch (err) {
                        console.error(`[Bulk-Block] Failed to fetch active sessions for ${server.name}:`, err.message);
                    }
                }
                
                for (const customer of customers.values()) {
                    try {
                        const username = customer.mikrotik_name.trim();
                        const isKickOnly = actionType === 'kick';
                        const isDisableOnly = actionType === 'disable';
                        const isBoth = !actionType;

                        // 1. Disable PPP Secret
                        if (isBoth || isDisableOnly) {
                            try {
                                const secrets = await client.write(['/ppp/secret/print', `?name=${username}`]);
                                if (secrets.length > 0) {
                                    if (secrets[0].disabled !== 'true' && secrets[0].disabled !== 'yes') {
                                        await client.write(['/ppp/secret/set', `=.id=${secrets[0]['.id']}`, '=disabled=yes']);
                                        console.log(`[Bulk-Block] Disabled secret for ${username}`);
                                    }
                                } else {
                                    // Try case-insensitive search if direct search fails
                                    const allSecrets = await client.write(['/ppp/secret/print']);
                                    const matchingSecret = allSecrets.find(s => s.name?.toLowerCase() === username.toLowerCase());
                                    if (matchingSecret) {
                                        await client.write(['/ppp/secret/set', `=.id=${matchingSecret['.id']}`, '=disabled=yes']);
                                        console.log(`[Bulk-Block] Disabled secret (case-insensitive) for ${username}`);
                                    } else {
                                        console.warn(`[Bulk-Block] Secret not found for ${username}.`);
                                    }
                                }
                            } catch (err) {
                                console.error(`[Bulk-Block] Disable error for ${username}:`, err.message);
                            }
                        }

                        // 2. Kill Active Sessions (Case-Insensitive)
                        if (isBoth || isKickOnly) {
                            try {
                                const matchingSessions = allActiveSessions.filter(s => s.name?.toLowerCase() === username.toLowerCase());
                                if (matchingSessions.length > 0) {
                                    for (const session of matchingSessions) {
                                        if (session['.id']) {
                                            await client.write(['/ppp/active/remove', `=.id=${session['.id']}`]);
                                            console.log(`[Bulk-Block] Killed active session for ${username}`);
                                        }
                                    }
                                }
                            } catch (err) {
                                console.error(`[Bulk-Block] Kill error for ${username}:`, err.message);
                            }
                        }

                        // 3. Update SQL Status
                        await customer.update({ status: 'isolated' });
                        blockedCount++;

                        // 4. Log History
                        const relevantInvoices = invoices.filter(inv => inv.customer_id === customer.id);
                        for (const inv of relevantInvoices) {
                            await InvoiceHistory.create({
                                invoice_id: inv.id,
                                user_name: user?.username || 'System',
                                action: 'STATUS_UPDATE',
                                details: `Bulk ${actionType || 'Block'} action performed on Mikrotik (Case-insensitive check).`
                            });
                        }

                    } catch (custErr) {
                        console.error(`[Bulk-Block] Error for ${customer.mikrotik_name}:`, custErr.message);
                        errors.push(`${customer.mikrotik_name}: ${custErr.message}`);
                    }
                }
                
                await client.close();
            } catch (connErr) {
                console.error(`[Bulk-Block] Connection failed for ${server.name}:`, connErr.message);
                errors.push(`Server ${server.name}: Connection failed`);
            }
        }

        logActivity(req, 'BULK_BLOCK_BILLING', `Performed bulk ${actionType || 'Block'} on ${blockedCount} users.`);
        res.json({ success: true, message: `Successfully processed ${blockedCount} customers.`, errors: errors.length > 0 ? errors : null });
    } catch (e) {
        console.error('[Bulk-Block] Fatal Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Create Payment (Pay Invoice)
app.post('/api/billing/pay', upload.single('proof'), async (req, res) => {
    const { invoiceId, amount, method, user, paymentDate } = req.body;
    const proof = req.file ? `/uploads/${req.file.filename}` : null;

    if (!invoiceId || !amount) return res.status(400).json({ error: 'Missing data' });

    try {
        const invoice = await Invoice.findByPk(invoiceId);
        if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

        // Update Invoice Status
        invoice.status = 'PAID';
        await invoice.save();

        const transactionDate = paymentDate ? new Date(paymentDate) : new Date();

        // Create Payment Record
        const payment = await Payment.create({
            invoice_id: invoiceId,
            amount,
            method,
            proof_url: proof,
            verified_at: transactionDate,
            transaction_date: transactionDate
        });

        // Log History
        await InvoiceHistory.create({
            invoice_id: invoiceId,
            user_name: user || 'System',
            action: 'PAYMENT',
            details: `Payment of Rp${amount} via ${method}`,
            timestamp: transactionDate
        });

        logActivity(req, 'PAY_INVOICE', `Paid invoice ${invoiceId} - Amount: ${amount}`);

        res.json({ success: true, payment });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Generate Invoices Manual Trigger
let isGeneratingInvoices = false;

app.post('/api/billing/generate', async (req, res) => {
    if (isGeneratingInvoices) {
        return res.status(429).json({ error: 'Invoice generation is already in progress. Please wait.' });
    }
    isGeneratingInvoices = true;
    
    const { serverId, month: customMonth, year: customYear } = req.body || {};
    // This would typically be a cron job
    try {
        const whereClause = { status: { [Op.in]: ['active', 'isolated'] } };
        if (serverId) whereClause.server_id = serverId;

        const activeCustomers = await Customer.findAll({ where: whereClause });
        
        let period;
        if (customMonth && customYear) {
            period = `${customYear}-${String(customMonth).padStart(2, '0')}`;
        } else {
            period = new Date().toISOString().slice(0, 7); // "2024-01"
        }

        // [OPTIMIZATION] Pre-load secrets cache for relevant servers
        const serverSecretsMap = {}; // serverId -> { mikrotikName -> secretObj }
        const customersMetaDB = getDB(); // Load customers.json (metadata)

        let count = 0;
        for (const customer of activeCustomers) {
            // Rule 1: Skip if profile is "BELUM AKTIF" or contains "GRATIS"
            const profileLower = (customer.profile || '').toLowerCase();
            if (profileLower.includes('belum aktif') || profileLower.includes('gratis')) {
                console.log(`[Invoice] Skipped ${customer.mikrotik_name} (Profile: ${customer.profile})`);
                continue;
            }

            // Rule 2: Skip if last-logged-out is epoch start (Never logged in)
            // Load cache if not loaded
            if (!serverSecretsMap[customer.server_id]) {
                const cachePath = getCachePath(customer.server_id, 'secrets');
                try {
                    if (fs.existsSync(cachePath)) {
                        const raw = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
                        // Index by name for fast lookup
                        const secretsParams = {};
                        if (Array.isArray(raw.data)) {
                            raw.data.forEach(s => { if (s.name) secretsParams[s.name] = s; });
                        }
                        serverSecretsMap[customer.server_id] = secretsParams;
                    } else {
                        serverSecretsMap[customer.server_id] = {};
                    }
                } catch (e) {
                    serverSecretsMap[customer.server_id] = {};
                    console.error(`[Invoice] Failed to load secrets cache for server ${customer.server_id}`, e);
                }
            }

            const secret = serverSecretsMap[customer.server_id][customer.mikrotik_name];
            const meta = customersMetaDB[`${customer.server_id}-${customer.mikrotik_name}`] || {};

            // Rule 3: Skip if mikrotik_name does NOT exist in the Mikrotik cache (phantom/stale DB record)
            // Only enforce this check if the cache is loaded (non-empty)
            if (Object.keys(serverSecretsMap[customer.server_id]).length > 0 && !secret) {
                console.log(`[Invoice] Skipped ${customer.mikrotik_name} (Not found in Mikrotik cache — possible stale/phantom record)`);
                continue;
            }

            // Check cache, then customer object, then metadata file
            const lastLogout = (secret && secret['last-logged-out']) || customer.last_logout || meta['last-logged-out'];

            if (lastLogout) {
                const lower = String(lastLogout).toLowerCase();
                // Check for "never logged in" (epoch)
                if (lower.startsWith('jan/01/1970') || lower.startsWith('1970-01-01')) {
                    console.log(`[Invoice] Skipped ${customer.mikrotik_name} (Never logged in / 1970-01-01)`);
                    continue;
                }
            }


            // Check if a VALID invoice exists (ignore INVALID/CANCELLED) for this mikrotik_name
            const exists = await Invoice.findOne({
                include: [{
                    model: Customer,
                    where: {
                        mikrotik_name: customer.mikrotik_name,
                        server_id: customer.server_id
                    }
                }],
                where: {
                    period,
                    status: { [Op.notIn]: ['INVALID', 'CANCELLED'] }
                }
            });

            if (!exists) {
                // Get Price from Profile DB (We still use profiles.json for price reference currently or need to migrate that too? 
                // The prompt didn't ask to migrate profiles.json explicitly but it holds prices.
                // Let's read profiles.json for now to get price.)
                const profiles = getProfilesDB();
                const key = `${customer.server_id}_${customer.profile}`;
                const price = profiles[key]?.price || 0;

                if (price > 0) {
                    // Calculate Due Date based on Server Config (Fixed Day of Month)
                    const server = await Server.findByPk(customer.server_id);
                    const dueDay = server ? (server.payment_due_days || 20) : 20;

                    // Parse period (YYYY-MM) to get year and month
                    const [year, month] = period.split('-').map(Number);

                    // Create date object for that day. Note: Month is 0-indexed in JS Date? 
                    // No, period "2024-01" -> month 1. JS Date(2024, 0, ...) is Jan. 
                    // So we use month - 1.
                    const dueDate = new Date(year, month - 1, dueDay);

                    await Invoice.create({
                        customer_id: customer.id,
                        server_id: customer.server_id,
                        period,
                        amount: price,
                        status: 'UNPAID',
                        due_date: dueDate
                    });
                    count++;
                }
            }
        }
        logActivity(req, 'GENERATE_INVOICES', `Generated ${count} invoices for period ${period}`);
        res.json({ message: `Generated ${count} invoices.` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    } finally {
        isGeneratingInvoices = false;
    }
});

// Check Overdue & Auto-Block
app.post('/api/billing/check-overdue', async (req, res) => {
    try {
        const today = new Date();
        const overdueInvoices = await Invoice.findAll({
            where: {
                status: 'UNPAID',
                due_date: { [Op.lt]: today } // due_date < today
            },
            include: [Customer]
        });

        let blockedCount = 0;
        for (const inv of overdueInvoices) {
            const customer = inv.Customer;
            const server = await Server.findByPk(customer.server_id);

            if (customer.status !== 'isolated' && server) {
                // Connect to Mikrotik
                const client = new RouterOSAPI({
                    host: server.ip,
                    port: server.port || 8728,
                    user: server.username,
                    password: server.password,
                    timeout: 20
                });

                client.on('error', (err) => {
                    console.error(`[Auto-Block] Client Error for ${server.ip}:`, err.message);
                });

                try {
                    await client.connect();
                    const username = customer.mikrotik_name.trim();
                    try {
                        const secrets = await client.write(['/ppp/secret/print', `?name=${username}`]);
                        if (secrets.length > 0 && secrets[0].disabled !== 'true' && secrets[0].disabled !== 'yes') {
                            await client.write(['/ppp/secret/set', `=.id=${secrets[0]['.id']}`, '=disabled=yes']);
                            console.log(`[Auto-Block] Disabled secret for ${username}`);
                            
                            // Check and kill active session if we just disabled it
                            const activeSessions = await client.write(['/ppp/active/print', `?name=${username}`]);
                            for (const session of activeSessions) {
                                if (session['.id']) await client.write(['/ppp/active/remove', `=.id=${session['.id']}`]);
                            }
                        }
                    } catch (err) {
                        console.warn(`[Auto-Block] Failed to process secret for ${username}:`, err.message);
                    }
                    await client.close();

                    // Update DB status
                    await customer.update({ status: 'isolated' });
                    blockedCount++;
                } catch (err) {
                    console.error(`[Auto-Block] Failed to block ${customer.mikrotik_name}:`, err.message);
                }
            }
        }

        logActivity(req, 'CHECK_OVERDUE', `Checked overdue invoices. Blocked ${blockedCount} customers.`);
        res.json({ message: `Checked overdue invoices. Blocked ${blockedCount} customers.` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- Profiles Metadata ---
const DB_PROFILES_FILE = path.join(__dirname, 'data', 'profiles.json');
const getProfilesDB = () => CACHE.profiles;
const saveProfilesDB = (data) => {
    CACHE.profiles = data;
    queueWrite('profiles', data);
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

// --- Servers Metadata (SQL) ---
app.get('/api/servers', async (req, res) => {
    try {
        const servers = await Server.findAll();
        res.json(servers);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/servers', async (req, res) => {
    const newServer = req.body;
    // Validate required fields
    if (!newServer.name || !newServer.ip || !newServer.username) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const server = await Server.create(newServer);
        logActivity(req, 'CREATE_SERVER', `Created server ${server.name} (${server.ip})`);
        res.json(server);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get Invoice History
app.get('/api/billing/invoices/:id/history', async (req, res) => {
    try {
        const { id } = req.params;
        const history = await InvoiceHistory.findAll({
            where: { invoice_id: id },
            order: [['timestamp', 'DESC']]
        });
        res.json(history);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Update Invoice (Single)
app.put('/api/billing/invoices/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, due_date, status, user } = req.body; // Expect user object or username

        const invoice = await Invoice.findByPk(id);
        if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

        const oldStatus = invoice.status;
        const oldAmount = invoice.amount;
        const oldDueDate = invoice.due_date;

        if (amount) invoice.amount = amount;
        if (due_date) invoice.due_date = due_date;
        if (status) invoice.status = status;

        await invoice.save();

        // Create History Log
        const changes = [];
        if (status && status !== oldStatus) changes.push(`Status: ${oldStatus} -> ${status}`);
        if (amount && amount != oldAmount) changes.push(`Amount: ${oldAmount} -> ${amount}`);
        if (due_date && due_date !== oldDueDate) changes.push(`Due Date: ${oldDueDate} -> ${due_date}`);

        if (changes.length > 0) {
            await InvoiceHistory.create({
                invoice_id: id,
                user_name: user?.username || user || 'Unknown',
                action: 'EDIT',
                details: changes.join(', ')
            });
        }

        res.json({ success: true, invoice });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Download Invoice PDF
app.get('/api/billing/invoices/:id/pdf', async (req, res) => {
    try {
        const { id } = req.params;
        const invoice = await Invoice.findOne({
            where: { id },
            include: [Customer]
        });

        if (!invoice) return res.status(404).send('Invoice not found');

        const doc = new PDFDocument();

        // Set headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.id.split('-')[0]}.pdf`);

        doc.pipe(res);

        // Header
        doc.fontSize(20).text('INVOICE', { align: 'center' });
        doc.moveDown();

        // Details
        doc.fontSize(12).text(`Invoice Number: ${invoice.id.split('-')[0].toUpperCase()}`);
        doc.text(`Date: ${invoice.createdAt.toISOString().split('T')[0]}`);
        doc.text(`Status: ${invoice.status}`);
        doc.moveDown();

        // Customer
        doc.text(`Customer: ${invoice.Customer?.name || 'Unknown'}`);
        doc.text(`Username: ${invoice.Customer?.mikrotik_name || 'N/A'}`);
        doc.moveDown();

        // Items (Simple Table)
        doc.text('-------------------------------------------------------');
        doc.text(`Description                                   Amount`);
        doc.text('-------------------------------------------------------');
        doc.text(`Internet Service (${invoice.period})           Rp ${Number(invoice.amount).toLocaleString('id-ID')}`);
        doc.moveDown();
        doc.text('-------------------------------------------------------');
        doc.fontSize(14).text(`Total: Rp ${Number(invoice.amount).toLocaleString('id-ID')}`, { align: 'right' });

        // Footer
        doc.moveDown(4);
        doc.fontSize(10).text('Thank you for your business!', { align: 'center' });

        // Stamp
        const stampPath = path.join(__dirname, 'assets', 'stamp.jpg');
        if (fs.existsSync(stampPath)) {
            // Center bottom, semi-transparent if possible (pdfkit supports opacity), 
            // but usually stamp is solid.
            // Let's put it over the footer or slightly to the right.
            // Page height ~792 for Letter/A4
            // doc.image(path, x, y, options)
            try {
                // Determine y position dynamically or fixed near bottom
                const y = doc.y + 20;
                const x = doc.page.width - 200; // Right side
                doc.image(stampPath, x, y, { width: 150 });
            } catch (err) {
                console.error('Error adding stamp image:', err);
            }
        }

        doc.end();

    } catch (e) {
        console.error(e);
        res.status(500).send('Error generating PDF');
    }
});

// Thermal Receipt HTML View
app.get('/api/billing/invoices/:id/thermal', async (req, res) => {
    try {
        const { id } = req.params;
        const invoice = await Invoice.findOne({
            where: { id },
            include: [Customer]
        });

        if (!invoice) return res.status(404).send('Invoice not found');

        const periodDate = new Date(invoice.period + '-01');
        const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
            "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        const formattedPeriod = `${monthNames[periodDate.getMonth()]} ${periodDate.getFullYear()}`;
        const petugas = req.query.petugas || 'Admin';

        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    @page { margin: 0; }
                    body { 
                        font-family: 'Courier New', Courier, monospace; 
                        width: 58mm; 
                        margin: 0; 
                        padding: 2mm;
                        font-size: 10px;
                        line-height: 1.2;
                    }
                    .center { text-align: center; }
                    .bold { font-weight: bold; }
                    .hr { border-top: 1px dashed black; margin: 2mm 0; }
                    .flex { display: flex; justify-content: space-between; }
                    @media print {
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="center bold">Bukti Pembayaran Wifi</div>
                <div class="hr"></div>
                <div>INV: ${invoice.id.split('-')[0].toUpperCase()}</div>
                <div>TGL: ${new Date(invoice.createdAt).toLocaleDateString('id-ID')}</div>
                <div class="hr"></div>
                <div>PELANGGAN:</div>
                <div class="bold">${invoice.Customer?.name || 'Unknown'}</div>
                <div>USER: ${invoice.Customer?.mikrotik_name || 'N/A'}</div>
                <div class="hr"></div>
                <div class="flex">
                    <span>Internet (${formattedPeriod})</span>
                </div>
                <div class="flex">
                    <span>TOTAL:</span>
                    <span class="bold">Rp ${Number(invoice.amount).toLocaleString('id-ID')}</span>
                </div>
                <div class="hr"></div>
                <div class="center">Status: ${invoice.status}</div>
                <div>PETUGAS: ${petugas}</div>
                <div class="hr"></div>
                <div class="center">Terima kasih atas</div>
                <div class="center">kepercayaan Anda!</div>
                <br>
                <div class="no-print center">
                    <button onclick="window.print()">Print Sekarang</button>
                </div>
                <script>
                    window.onload = () => {
                       // Uncomment if you want auto-print dialog
                       // window.print();
                    }
                </script>
            </body>
            </html>
        `);
    } catch (e) {
        console.error(e);
        res.status(500).send('Error generating thermal receipt');
    }
});

// Delete Invoice (Superadmin only)
app.delete('/api/billing/invoices/:id', async (req, res) => {
    const { id } = req.params;
    const { user } = req.body; // Expect user object (containing role)

    if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) {
        return res.status(403).json({ error: 'Access denied. Authorized users only.' });
    }

    try {
        const invoice = await Invoice.findByPk(id);
        if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

        // Safe Delete: Remove related records first to prevent Foreign Key constraints
        await Payment.destroy({ where: { invoice_id: id } });
        await InvoiceHistory.destroy({ where: { invoice_id: id } });

        await invoice.destroy();

        // Log activity (reuse logic if available or just skip/log to console for now as we don't have request based user in context easily for logActivity helper without middleware)
        console.log(`[Billing] Invoice ${id} deleted by ${user.username}`);

        res.json({ success: true, message: 'Invoice deleted successfully' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/servers/:id', async (req, res) => {
    const { id } = req.params;
    const updatedData = req.body;

    try {
        const server = await Server.findByPk(id);
        if (!server) return res.status(404).json({ error: 'Server not found' });

        await server.update(updatedData);
        logActivity(req, 'UPDATE_SERVER', `Updated server ${server.name}`);
        res.json(server);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/servers/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const server = await Server.findByPk(id);
        if (server) {
            await server.destroy();
            
            // Cleanup cache files
            const resources = ['secrets', 'profiles', 'pools', 'interfaces', 'active_ppp'];
            for (const resType of resources) {
                const cachePath = getCachePath(id, resType);
                if (fs.existsSync(cachePath)) {
                    try {
                        fs.unlinkSync(cachePath);
                    } catch (err) {
                        console.error(`Failed to delete cache file ${cachePath}:`, err.message);
                    }
                }
            }

            logActivity(req, 'DELETE_SERVER', `Deleted server ID ${id}`);
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
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
const getRegistrationsDB = () => CACHE.registrations;
const saveRegistrationsDB = (data) => {
    CACHE.registrations = data;
    queueWrite('registrations', data);
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

    logActivity(req, 'CREATE_REGISTRATION', `New registration for ${newReg.fullName}`);

    res.json(newReg);
});

// Update Registration (General & Status)
app.put('/api/registrations/:id', async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const db = getRegistrationsDB();
    const index = db.findIndex(r => r.id === id);

    if (index === -1) {
        return res.status(404).json({ error: 'Registration not found' });
    }

    // Merge updates
    const currentInstallation = db[index].installation || {};
    const newInstallation = updates.installation || {};

    // Deep merge for installation if provided
    let mergedInstallation = undefined;
    if (updates.installation) {
        mergedInstallation = { ...currentInstallation, ...newInstallation };
    }

    db[index] = {
        ...db[index],
        ...updates,
        installation: mergedInstallation || db[index].installation
    };

    // Logic: If status becomes 'installation_process' and no workingOrderStatus yet, set it to 'pending'
    if (db[index].status === 'installation_process' && !db[index].workingOrderStatus) {
        db[index].workingOrderStatus = 'pending';
    }

    saveRegistrationsDB(db);

    // [NEW] Sync to SQL if status is 'done' and we have secret details
    try {
        if (db[index].status === 'done' && db[index].installation) {
            const secretName = db[index].installation.secretName;
            const coordinates = db[index].installation.coordinates;

            if (secretName) {
                // Find Server ID by Name (locationId)
                const server = await Server.findOne({ where: { name: db[index].locationId } });

                if (server) {
                    // Upsert Customer
                    const [customer, created] = await Customer.findOrCreate({
                        where: { mikrotik_name: secretName.toLowerCase(), server_id: server.id },
                        defaults: {
                            name: db[index].fullName,
                            phone_number: db[index].phoneNumber,
                            address: db[index].address,
                            status: 'active',
                            sub_area_id: db[index].sub_area_id || null,
                            odp_id: db[index].odpId || null,
                            coordinates: coordinates || null
                        }
                    });

                    if (!created) {
                        // Update if exists
                        await customer.update({
                            name: db[index].fullName,
                            phone_number: db[index].phoneNumber,
                            address: db[index].address,
                            status: 'active',
                            sub_area_id: db[index].sub_area_id || customer.sub_area_id,
                            coordinates: coordinates || customer.coordinates
                        });
                    }
                    console.log(`[Sync] Customer ${secretName} synced to CRM/SQL successfully.`);
                } else {
                    console.warn(`[Sync] Server not found for location: ${db[index].locationId}`);
                }
            }
        }
    } catch (error) {
        console.error("[Sync] Failed to sync customer to SQL in PUT:", error);
    }

    logActivity(req, 'UPDATE_REGISTRATION', `Updated registration for ${db[index].fullName} (Status: ${db[index].status})`);

    res.json(db[index]);
});

// Delete Registration
app.delete('/api/registrations/:id', (req, res) => {
    const { id } = req.params;
    let db = getRegistrationsDB();
    db = db.filter(r => r.id !== id);
    saveRegistrationsDB(db);

    logActivity(req, 'DELETE_REGISTRATION', `Deleted registration ID ${id}`);

});

// Complete Registration (Installation) with Photos
app.post('/api/registrations/:id/complete', upload.array('photos'), async (req, res) => {
    const { id } = req.params;
    const { secretId, note, sub_area_id, secretName, coordinates, ssidName, ssidPassword, signalLevel, installationDate } = req.body;
    const files = req.files;

    const db = getRegistrationsDB();
    const index = db.findIndex(r => r.id === id);

    if (index === -1) {
        return res.status(404).json({ error: 'Registration not found' });
    }

    if (!files || files.length === 0) {
        return res.status(400).json({ error: 'At least one photo is required.' });
    }

    const photoPaths = files.map(f => `/uploads/${f.filename}`);

    // Handle existing photos (parse JSON if sent as string, or array)
    let finalPhotos = [...photoPaths];
    if (req.body.existingPhotos) {
        try {
            const existing = JSON.parse(req.body.existingPhotos);
            if (Array.isArray(existing)) {
                finalPhotos = [...finalPhotos, ...existing];
            }
        } catch (e) {
            console.error('Error parsing existingPhotos:', e);
        }
    }

    // Update Registration
    db[index] = {
        ...db[index],
        status: 'done',
        workingOrderStatus: 'done',
        workingOrderNote: note || db[index].workingOrderNote,
        sub_area_id: sub_area_id || db[index].sub_area_id,
        installation: {
            ...db[index].installation,
            finishDate: new Date().toISOString(),
            photos: finalPhotos, // Use the combined list
            secretId: secretId,
            coordinates: coordinates || db[index].installation?.coordinates,
            ssidName: ssidName,
            ssidPassword: ssidPassword,
            signalLevel: signalLevel,
            installationDate: installationDate
        }
    };

    saveRegistrationsDB(db);

    // Sync to SQL Customer (Create or Update)
    try {
        if (secretName) {
            // Find Server ID
            const server = await Server.findOne({ where: { name: db[index].locationId } }); 


            if (server) {
                // Upsert Customer
                const [customer, created] = await Customer.findOrCreate({
                    where: { mikrotik_name: secretName.toLowerCase(), server_id: server.id },
                    defaults: {
                        name: db[index].fullName,
                        phone_number: db[index].phoneNumber,
                        address: db[index].address,
                        status: 'active',
                        sub_area_id: sub_area_id || null,
                        odp_id: db[index].odpId || null,
                        coordinates: coordinates || null,
                        photos: finalPhotos || [],
                        ktp: db[index].ktpNumber || null,
                        activationDate: new Date().toISOString().split('T')[0],
                        mapsUrl: db[index].mapsUrl || null,
                        installationDate: installationDate || new Date().toISOString().split('T')[0],
                        ssidName: ssidName || null,
                        ssidPassword: ssidPassword || null,
                        signalLevel: signalLevel || null
                    }
                });

                if (!created) {
                    // Update if exists
                    await customer.update({
                        name: db[index].fullName,
                        phone_number: db[index].phoneNumber,
                        address: db[index].address,
                        status: 'active',
                        sub_area_id: sub_area_id || customer.sub_area_id,
                        odp_id: db[index].odpId || customer.odp_id,
                        coordinates: coordinates || customer.coordinates,
                        photos: finalPhotos || customer.photos,
                        ktp: db[index].ktpNumber || customer.ktp,
                        activationDate: customer.activationDate || new Date().toISOString().split('T')[0],
                        mapsUrl: db[index].mapsUrl || customer.mapsUrl,
                        installationDate: installationDate || customer.installationDate,
                        ssidName: ssidName || customer.ssidName,
                        ssidPassword: ssidPassword || customer.ssidPassword,
                        signalLevel: signalLevel || customer.signalLevel
                    });
                }
                console.log(`[Sync] Customer ${secretName} synced successfully.`);
            }
        }
    } catch (error) {
        console.error("[Sync] Failed to sync customer to SQL:", error);
        // Don't fail the request, just log
    }

    saveRegistrationsDB(db);

    logActivity(req, 'COMPLETE_INSTALLATION', `Completed installation for ${db[index].fullName}`);

    res.json(db[index]);
});

// --- Job Titles ---
const DB_JOB_TITLES_FILE = path.join(__dirname, 'data', 'job_titles.json');
const getJobTitlesDB = () => CACHE.jobTitles;
const saveJobTitlesDB = (data) => {
    CACHE.jobTitles = data;
    queueWrite('jobTitles', data);
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
const getEmployeesDB = () => CACHE.employees;
const saveEmployeesDB = (data) => {
    CACHE.employees = data;
    queueWrite('employees', data);
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

// --- Damage Types ---
const DB_DAMAGE_TYPES_FILE = path.join(__dirname, 'data', 'damage_types.json');
const getDamageTypesDB = () => CACHE.damageTypes;
const saveDamageTypesDB = (data) => {
    CACHE.damageTypes = data;
    queueWrite('damageTypes', data);
};


app.get('/api/damage-types', (req, res) => {
    res.json(getDamageTypesDB());
});

app.post('/api/damage-types', (req, res) => {
    const newItem = req.body;
    if (!newItem.id) newItem.id = crypto.randomUUID();
    if (!newItem.createdAt) newItem.createdAt = new Date().toISOString();

    if (!newItem.name) return res.status(400).json({ error: 'Name is required' });

    const db = getDamageTypesDB();
    db.push(newItem);
    saveDamageTypesDB(db);
    res.json(newItem);
});

app.put('/api/damage-types/:id', (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const db = getDamageTypesDB();
    const index = db.findIndex(i => i.id === id);
    if (index === -1) return res.status(404).json({ error: 'Not found' });

    db[index] = { ...db[index], ...updates };
    saveDamageTypesDB(db);
    res.json(db[index]);
});

app.delete('/api/damage-types/:id', (req, res) => {
    const { id } = req.params;
    let db = getDamageTypesDB();
    db = db.filter(i => i.id !== id);
    saveDamageTypesDB(db);
    res.json({ success: true });
});

// --- Sub Areas ---
const DB_SUB_AREAS_FILE = path.join(__dirname, 'data', 'sub_areas.json');
const getSubAreasDB = () => CACHE.subAreas;
const saveSubAreasDB = (data) => {
    CACHE.subAreas = data;
    queueWrite('subAreas', data);
};


app.get('/api/sub-areas', (req, res) => {
    res.json(getSubAreasDB());
});

app.post('/api/sub-areas', (req, res) => {
    const newItem = req.body;
    if (!newItem.id) newItem.id = crypto.randomUUID();
    if (!newItem.createdAt) newItem.createdAt = new Date().toISOString();

    if (!newItem.name) return res.status(400).json({ error: 'Name is required' });
    if (!newItem.serverId) return res.status(400).json({ error: 'Server ID is required' });

    const db = getSubAreasDB();
    db.push(newItem);
    saveSubAreasDB(db);
    res.json(newItem);
});

app.put('/api/sub-areas/:id', (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const db = getSubAreasDB();
    const index = db.findIndex(i => i.id === id);
    if (index === -1) return res.status(404).json({ error: 'Not found' });

    db[index] = { ...db[index], ...updates };
    saveSubAreasDB(db);
    res.json(db[index]);
});

app.delete('/api/sub-areas/:id', (req, res) => {
    const { id } = req.params;
    let db = getSubAreasDB();
    db = db.filter(i => i.id !== id);
    saveSubAreasDB(db);
    res.json({ success: true });
});

// --- Support Tickets ---
const DB_TICKETS_FILE = path.join(__dirname, 'data', 'tickets.json');
const getTicketsDB = () => CACHE.tickets;
const saveTicketsDB = (data) => {
    CACHE.tickets = data;
    queueWrite('tickets', data);
};


app.get('/api/tickets', (req, res) => {
    res.json(getTicketsDB());
});

app.post('/api/tickets', (req, res) => {
    const newItem = req.body;
    if (!newItem.id) newItem.id = crypto.randomUUID();
    if (!newItem.createdAt) newItem.createdAt = new Date().toISOString();
    if (!newItem.status) newItem.status = 'open';

    const db = getTicketsDB();
    db.push(newItem);
    saveTicketsDB(db);
    res.json(newItem);
});

app.put('/api/tickets/:id', (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const db = getTicketsDB();
    const index = db.findIndex(i => i.id === id);
    if (index === -1) return res.status(404).json({ error: 'Not found' });

    db[index] = { ...db[index], ...updates };
    saveTicketsDB(db);
    res.json(db[index]);
});

app.delete('/api/tickets/:id', (req, res) => {
    const { id } = req.params;
    let db = getTicketsDB();
    db = db.filter(i => i.id !== id);
    saveTicketsDB(db);
    res.json({ success: true });
});

// --- Payment Methods ---
const DB_PAYMENT_METHODS_FILE = path.join(__dirname, 'data', 'payment_methods.json');
const getPaymentMethodsDB = () => CACHE.paymentMethods;
const savePaymentMethodsDB = (data) => {
    CACHE.paymentMethods = data;
    queueWrite('paymentMethods', data);
};


app.get('/api/payment-methods', (req, res) => {
    res.json(getPaymentMethodsDB());
});

app.post('/api/payment-methods', (req, res) => {
    const newItem = req.body;
    if (!newItem.id) newItem.id = crypto.randomUUID();

    if (!newItem.name) return res.status(400).json({ error: 'Name is required' });

    const db = getPaymentMethodsDB();
    db.push(newItem);
    savePaymentMethodsDB(db);
    res.json(newItem);
});

app.put('/api/payment-methods/:id', (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const db = getPaymentMethodsDB();
    const index = db.findIndex(i => i.id === id);
    if (index === -1) return res.status(404).json({ error: 'Not found' });

    db[index] = { ...db[index], ...updates };
    savePaymentMethodsDB(db);
    res.json(db[index]);
});

app.delete('/api/payment-methods/:id', (req, res) => {
    const { id } = req.params;
    let db = getPaymentMethodsDB();
    db = db.filter(i => i.id !== id);
    savePaymentMethodsDB(db);
    res.json({ success: true });
});


// --- Authentication ---
const DB_USERS_FILE = path.join(__dirname, 'data', 'users.json');
const getUsersDB = () => CACHE.users;
const saveUsersDB = (data) => {
    CACHE.users = data;
    queueWrite('users', data);
};

// --- Network Nodes (ODC/ODP) ---
const DB_NODES_FILE = path.join(__dirname, 'data', 'network_nodes.json');
const getNodesDB = () => CACHE.networkNodes;
const saveNodesDB = (data) => {
    CACHE.networkNodes = data;
    queueWrite('networkNodes', data);
};

app.get('/api/network/nodes', (req, res) => {
    res.json(getNodesDB());
});

app.post('/api/network/nodes', (req, res) => {
    const newNode = req.body;
    if (!newNode.id) newNode.id = crypto.randomUUID();
    if (!newNode.type || !newNode.name || !newNode.lat || !newNode.lng) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const db = getNodesDB();
    db.push(newNode);
    saveNodesDB(db);

    logActivity(req, 'CREATE_NODE', `Created ${newNode.type} node: ${newNode.name}`);
    res.json(newNode);
});

app.put('/api/network/nodes/:id', (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const db = getNodesDB();
    const index = db.findIndex(n => n.id === id);
    if (index === -1) return res.status(404).json({ error: 'Node not found' });

    db[index] = { ...db[index], ...updates };
    saveNodesDB(db);

    logActivity(req, 'UPDATE_NODE', `Updated node: ${db[index].name}`);
    res.json(db[index]);
});

app.delete('/api/network/nodes/:id', (req, res) => {
    const { id } = req.params;
    let db = getNodesDB();
    db = db.filter(n => n.id !== id);
    saveNodesDB(db);

    logActivity(req, 'DELETE_NODE', `Deleted node ID: ${id}`);
    res.json({ success: true });
});

// Link Customer to ODP
// We store this link in the Customer SQL DB, and auto-create ONT if not exists
app.post('/api/network/link-customer', async (req, res) => {
    const { serverId, customerId, odpId } = req.body;
    if (!serverId || !customerId) return res.status(400).json({ error: 'Missing identity' });

    try {
        // 1. Link customer → ODP in SQL
        const customer = await Customer.findOne({ where: { server_id: serverId, mikrotik_name: customerId.toLowerCase() } });
        if (customer) {
            await customer.update({ odp_id: odpId });
        } else {
            await Customer.create({
                server_id: serverId,
                mikrotik_name: customerId.toLowerCase(),
                odp_id: odpId,
                status: 'active'
            });
        }

        const nodesDb = getNodesDB();

        // 2. Handle ONT node (Cleanup or Auto-creation)
        if (odpId === null) {
            // Unlinking Case: Remove existing ONT node from map if it exists
            const filteredNodes = nodesDb.filter(n => !(n.type === 'ONT' && n.refId === customerId));
            if (filteredNodes.length !== nodesDb.length) {
                saveNodesDB(filteredNodes);
                logActivity(req, 'DELETE_NODE', `Removed ONT node for unlinked customer: ${customerId}`);
            }
        } else {
            // Linking Case: Auto-create ONT node if it doesn't already exist
            const existingOnt = nodesDb.find(n => n.type === 'ONT' && n.refId === customerId && n.parentId === odpId);
            if (!existingOnt) {
                // Find ODP position to place ONT nearby (slight offset so they don't overlap)
                const odpNode = nodesDb.find(n => n.id === odpId);
                const baseLat = odpNode ? odpNode.lat + 0.00005 : -0.366535;
                const baseLng = odpNode ? odpNode.lng + 0.00005 : 101.556898;
                
                const ontNode = {
                    id: crypto.randomUUID(),
                    type: 'ONT',
                    name: customerId,
                    lat: baseLat,
                    lng: baseLng,
                    capacity: 1,
                    parentId: odpId,
                    refId: customerId,
                    notes: `Auto-created for PPPoE: ${customerId}`,
                    createdAt: new Date().toISOString()
                };
                nodesDb.push(ontNode);
                saveNodesDB(nodesDb);
                logActivity(req, 'CREATE_NODE', `Auto-created ONT node for: ${customerId}`);
            }
        }
        
        logActivity(req, 'LINK_CUSTOMER', odpId === null ? `Unlinked ${customerId} from ODP` : `Linked ${customerId} to ODP ${odpId}`);
        res.json({ success: true });
    } catch (e) {
        console.error("Failed to link customer", e);
        res.status(500).json({ error: e.message });
    }
});

// --- Monitoring Status ---
const DB_STATUS_FILE = path.join(__dirname, 'data', 'network_status.json');
const getStatusDB = () => CACHE.status;
const saveStatusDB = (data) => {
    CACHE.status = data;
    queueWrite('status', data);
};


app.get('/api/network/status', (req, res) => {
    res.json(getStatusDB());
});

// Background Ping Service
const runNetworkMonitor = async () => {
    console.log('[Monitor] Starting network scan...');
    try {
        const servers = await Server.findAll();
        const statusDB = getStatusDB();
        let updates = 0;

        for (const server of servers) {
            // Skip if no credentials (though we need them)
            if (!server.username) continue;

            try {
                const cachePath = getCachePath(server.id, 'secrets');
                if (!fs.existsSync(cachePath)) continue;

                // Async read secrets cache
                const rawData = await fs.promises.readFile(cachePath, 'utf8');
                const secrets = JSON.parse(rawData).data;
                const targets = secrets.filter(s => s['remote-address'] && !s.disabled);

                if (targets.length === 0) continue;


                const client = new RouterOSAPI({
                    host: server.ip,
                    port: server.port || 8728,
                    user: server.username,
                    password: server.password,
                    keepalive: false,
                    timeout: 30
                });

                client.on('error', (err) => {
                    console.error(`[Ping] Client Error for ${server.ip}:`, err.message);
                });

                await client.connect();

                // Batch ping or sequential? Sequential is safer for router load.
                // Mikrotik /ping command.
                for (const target of targets) {
                    try {
                        const ip = target['remote-address'];
                        const pingRes = await client.write(['/ping', `=address=${ip}`, '=count=1', '=interval=0.2']);
                        // Result exampl: [{ "seq": "1", "host": "192.168.1.10", "status": "timeout" }] or size/ttl

                        const result = Array.isArray(pingRes) ? pingRes[0] : pingRes;
                        const isOnline = result && !result.status; // status is present on timeout/unreachable usually? 
                        // Actually RouterOS ping returns property "received" if we use count.
                        // Let's use standard result checking.
                        // If successful: { "seq": 1, "host": "...", "size": 64, "ttl": 64, "time": "10ms" }
                        // If fail: { "seq": 1, "host": "...", "status": "timeout" }

                        const online = result && result.time; // If 'time' exists, it answered.

                        const key = `${server.id}_${target.name.toLowerCase()}`;
                        statusDB[key] = {
                            isOnline: !!online,
                            lastCheck: new Date(),
                            latency: online ? result.time : -1
                        };
                        updates++;
                    } catch (pe) {
                        // console.error(`Ping failed for ${target.name}`, pe);
                    }
                }

                client.close();

            } catch (e) {
                console.error(`[Monitor] Failed server ${server.name}:`, e.message);
            }
        }

        if (updates > 0) {
            saveStatusDB(statusDB);
            console.log(`[Monitor] Updated status for ${updates} nodes.`);
        }
    } catch (error) {
        console.error('[Monitor] Global Error:', error);
    }
};

// Start Monitor Loop (Every 5 minutes)
if (process.env.ENABLE_MONITORING !== 'false') {
    setInterval(runNetworkMonitor, 5 * 60 * 1000);
    // Run once on startup after short delay
    setTimeout(runNetworkMonitor, 10000);
}



// Login
app.post('/api/auth/login', (req, res) => {
    let { username, password } = req.body;

    // Trim whitespace
    if (username) username = username.trim();
    if (password) password = password.trim();

    console.log(`[Auth] Login attempt for: '${username}'`);

    const users = getUsersDB();
    const user = users.find(u => u.username === username && u.password === password);

    if (!user) {
        console.warn(`[Auth] Failed login for '${username}' (Invalid credentials)`);
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create Session
    const token = crypto.randomUUID();
    const sessions = getSessionsDB();
    sessions[token] = {
        userId: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        createdAt: new Date().toISOString()
    };
    saveSessionsDB(sessions);

    logActivity(req, 'LOGIN', { username: user.username, role: user.role });

    res.json({ token, user: { id: user.id, username: user.username, role: user.role, name: user.name, employeeId: user.employeeId } });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
    const { token } = req.body;
    if (token) {
        const sessions = getSessionsDB();
        delete sessions[token];
        saveSessionsDB(sessions);
    }
    res.json({ success: true });
});

// Get Current User (Verify Token)
app.get('/api/auth/me', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    const sessions = getSessionsDB();
    const session = sessions[token];

    if (!session) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const users = getUsersDB();
    const user = users.find(u => u.id === session.userId);

    if (user) {
        res.json({ user: { id: user.id, username: user.username, role: user.role, name: user.name, employeeId: user.employeeId } });
    } else {
        res.json({ user: { id: session.userId, username: session.username, role: session.role, name: session.name } });
    }
});

// Get Logging Config
app.get('/api/logs/config', (req, res) => {
    res.json(CACHE.loggingConfig || {});
});

// Update Logging Config
app.post('/api/logs/config', (req, res) => {
    const newConfig = req.body;
    CACHE.loggingConfig = newConfig;
    queueWrite('loggingConfig', newConfig);
    res.json({ success: true, config: CACHE.loggingConfig });
});

// --- Activity Logs Endpoint ---
app.get('/api/logs', (req, res) => {
    // Optionally verify admin role here
    const logs = getLogsDB();
    res.json(logs);
});

// --- User Management (Superadmin) ---
app.get('/api/users', (req, res) => {
    // Ideally verify superadmin here, but for simplicity assuming UI protects it + maybe simple token check if needed later.
    const users = getUsersDB();
    // Return safe data
    const safeUsers = users.map(u => ({ id: u.id, username: u.username, role: u.role, name: u.name, employeeId: u.employeeId }));
    res.json(safeUsers);
});

app.post('/api/users/manage', (req, res) => {
    const { employeeId, username, password, role, name } = req.body;

    if (!employeeId || !username || !role) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const users = getUsersDB();
    const existingUserIndex = users.findIndex(u => u.employeeId === employeeId);

    // Check if username is taken by ANOTHER user
    const usernameTaken = users.find(u => u.username === username && u.employeeId !== employeeId);
    if (usernameTaken) {
        return res.status(400).json({ error: 'Username already taken' });
    }

    if (existingUserIndex !== -1) {
        // Update existing
        users[existingUserIndex] = {
            ...users[existingUserIndex],
            username,
            role,
            name,
            // Update password only if provided
            ...(password ? { password } : {})
        };
    } else {
        // Create new
        users.push({
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            employeeId,
            username,
            password: password || '123456', // Default if somehow missing, but frontend should require it
            role,
            name
        });
    }

    saveUsersDB(users);

    const actionType = existingUserIndex !== -1 ? 'UPDATE_USER' : 'CREATE_USER';
    logActivity(req, actionType, `${actionType === 'CREATE_USER' ? 'Created' : 'Updated'} user ${username} (${role})`);

    res.json({ success: true });
});

// Backup Data
app.get('/api/backup', async (req, res) => {
    try {
        const archive = archiver('zip', { zlib: { level: 9 } });

        res.attachment(`backup-${new Date().toISOString().split('T')[0]}.zip`);

        archive.pipe(res);

        // Append data directory
        archive.directory(path.join(__dirname, 'data'), 'data');

        // Append uploads directory
        if (fs.existsSync(path.join(__dirname, 'uploads'))) {
            archive.directory(path.join(__dirname, 'uploads'), 'uploads');
        }

        await archive.finalize();
    } catch (error) {
        console.error('Backup failed:', error);
        res.status(500).send('Backup failed');
    }
});

// Restore Data
app.post('/api/restore', upload.single('backup'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    console.log(`[Restore] Received file: ${req.file.originalname} (${req.file.size} bytes)`);
    console.log(`[Restore] Stored at: ${req.file.path}`);
    console.log(`[Restore] Mimetype: ${req.file.mimetype}`);

    if (req.file.size === 0) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Uploaded file is empty.' });
    }

    try {
        const zip = new AdmZip(req.file.path);

        // Before extracting, close the SQLite database connection to release file locks.
        // This is critical on Windows to prevent EBUSY/EPERM errors during extraction.
        try {
            await sequelize.close();
            console.log('[Restore] SQLite connection closed.');
        } catch (dbError) {
            console.warn('[Restore] Warning: Failed to close SQLite connection:', dbError.message);
        }

        // Extract to server directory (overwriting data/ and uploads/)
        zip.extractAllTo(__dirname, true);

        // Clean up uploaded zip
        fs.unlinkSync(req.file.path);

        // Log using file-based cache which is still in memory (though it will be wiped on restart)
        logActivity(req, 'RESTORE_DATA', 'System data restored from backup');

        res.json({ success: true, message: 'Data restored successfully. System will restart.' });

        // Exit process so PM2 or nodemon can restart the app with new data and re-initialize DB
        setTimeout(() => {
            console.log('[Restore] Restarting process to apply restored data...');
            process.exit(0);
        }, 1500);

    } catch (error) {
        console.error('Restore failed:', error);
        res.status(500).json({ error: 'Restore failed: ' + error.message });
        // Clean up
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    }
});

// Reset Data Endpoint (Selective)
app.post('/api/reset', async (req, res) => {
    try {
        // 1. Clear Registrations and Tickets
        saveRegistrationsDB([]);
        saveTicketsDB([]);

        // 3. Reset SQLite Transaction Data (Invoices, Payments, InvoiceHistory)
        // Delete dependents first to avoid Foreign Key violations
        await Payment.destroy({ where: {} });
        await InvoiceHistory.destroy({ where: {} });
        
        await sequelize.sync({ alter: false });

        // [MIGRATION-V3] Standardize all existing mikrotik_names to lowercase for consistency
        // This is critical for Linux-based production servers like aaPanel.
        console.log('[Database] Running mikrotik_name standardization (V3)...');
        const customersToFix = await Customer.findAll();
        for (const c of customersToFix) {
            const currentName = c.mikrotik_name || '';
            const lowerName = currentName.toLowerCase().trim();
            if (currentName !== lowerName) {
                await c.update({ mikrotik_name: lowerName });
                console.log(`[Database] Migrated SQL: ${currentName} -> ${lowerName}`);
            }
        }
        console.log('[Database] Standardization complete.');
        
        await Invoice.destroy({ where: {} });

        logActivity(req, 'RESET_DATA', 'System data reset (Selective)');
        res.json({ success: true, message: 'App data cleared successfully.' });
    } catch (error) {
        console.error('Reset Error:', error);
        res.status(500).json({ error: 'Reset failed: ' + error.message });
    }
});

// --- Static Files & SPA Fallback ---

const DIST_PATH = fs.existsSync(path.join(__dirname, '../dist')) 
    ? path.join(__dirname, '../dist')
    : fs.existsSync(path.join(__dirname, 'dist'))
        ? path.join(__dirname, 'dist')
        : path.join(__dirname, '../public_html');

if (fs.existsSync(DIST_PATH)) {
    console.log(`[Frontend] Serving static files from: ${path.resolve(DIST_PATH)}`);
    // Static files first
    app.use(express.static(DIST_PATH, {
        maxAge: '1d',
        setHeaders: (res, path) => {
            if (path.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript');
        }
    }));
}

// SPA Fallback: Serve index.html for any unknown non-API routes 
// (excluding files that might have extension but weren't found in static)
app.get(/.*/, (req, res) => {
    // Only fallback for non-API routes
    if (req.url.startsWith('/api')) {
        return res.status(404).json({ error: 'API route not found' });
    }

    const indexPath = path.join(DIST_PATH, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('Frontend build not found. Path searched: ' + DIST_PATH);
    }
});



app.listen(PORT, HOST, () => {
    console.log(`Mikrotik API Proxy + CRM DB running on http://${HOST}:${PORT}`);
});
