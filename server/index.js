import express from 'express';
import cors from 'cors';
import routeros from 'node-routeros';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { initDB, Server, Invoice, Payment, Customer, InvoiceHistory, RemoteDevice, OnuChangeLog, CustomerVoucher } from './models/index.js';
import { Sequelize, Op } from 'sequelize';
import archiver from 'archiver';
import AdmZip from 'adm-zip';
import PDFDocument from 'pdfkit';

const { RouterOSAPI } = routeros;
const APP_VERSION = '1.0.6-MULTI-ACCOUNT-OPTIMIZED-PROD';



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

app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-Webhook-Token', 'Svix-Id', 'Svix-Timestamp', 'Svix-Signature']
}));
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

// Health Check & Version Endpoints
const getHealthInfo = () => ({
    status: 'ok',
    version: APP_VERSION,
    updatedAt: '2026-09-11 02:45 WIB',
    features: ['multiple-vouchers-fix', 'cid-comment-matching', 'custom-server-url'],
    time: new Date().toISOString(),
    db: 'connected'
});

app.get('/api/health', (req, res) => res.json(getHealthInfo()));
app.get('/api/version', (req, res) => res.json(getHealthInfo()));
app.get('/version', (req, res) => res.json(getHealthInfo()));


// [DEBUG] Explicit Customers Route (Priority)
app.get('/api/customers', async (req, res) => {

    console.log('[DEBUG] HIT /api/customers');
    try {
        // Use models imported at line 9
        const servers = await Server.findAll();
        const sqlCustomers = await Customer.findAll();
        
        const sqlMap = new Map();
        const nameMap = new Map();
        const phonePasswordMap = new Map();
        const phoneCustomerMap = new Map();

        sqlCustomers.forEach(c => {
            const json = c.toJSON();
            const key = `${String(c.server_id).toLowerCase()}-${String(c.mikrotik_name).toLowerCase().trim()}`;
            sqlMap.set(key, json);
            if (c.mikrotik_name) {
                nameMap.set(String(c.mikrotik_name).toLowerCase().trim(), json);
            }
            if (c.phone_number) {
                const clean = c.phone_number.replace(/\D/g, '');
                if (clean && clean.length >= 6) {
                    phoneCustomerMap.set(clean, json);
                    if (clean.length >= 8) {
                        phoneCustomerMap.set(clean.slice(-8), json);
                    }
                }
            }
            if (c.phone_number && c.password) {
                const clean = c.phone_number.replace(/\D/g, '');
                if (clean && clean.length >= 6) {
                    phonePasswordMap.set(clean, c.password);
                    if (clean.length >= 8) {
                        phonePasswordMap.set(clean.slice(-8), c.password);
                    }
                }
            }
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
                const nameKey = String(secret.name).toLowerCase().trim();
                let sqlC = sqlMap.get(key) || nameMap.get(nameKey);
                processedKeys.add(key);

                // Fallback: match by phone number in secret comment or secret name
                if (!sqlC) {
                    const rawText = `${secret.comment || ''} ${secret.name || ''}`;
                    const phoneMatches = rawText.match(/\d{6,15}/g) || [];
                    for (const candidate of phoneMatches) {
                        const cleanCand = candidate.replace(/\D/g, '');
                        const found = phoneCustomerMap.get(cleanCand) || phoneCustomerMap.get(cleanCand.slice(-8));
                        if (found) {
                            sqlC = found;
                            break;
                        }
                    }
                }
                
                let lat = null, long = null;
                if (sqlC?.coordinates?.includes(',')) {
                    const parts = sqlC.coordinates.split(',');
                    lat = parts[0].trim();
                    long = parts[1].trim();
                }

                // Resolve effective appPassword (check SQL record password -> phonePasswordMap -> default 'nusantara!')
                let effectivePassword = sqlC?.password;
                if (!effectivePassword) {
                    const rawText = `${sqlC?.phone_number || ''} ${secret.comment || ''} ${secret.name || ''}`;
                    const phoneMatches = rawText.match(/\d{6,15}/g) || [];
                    for (const candidate of phoneMatches) {
                        const cleanCand = candidate.replace(/\D/g, '');
                        if (cleanCand && cleanCand.length >= 6) {
                            for (const [pKey, pVal] of phonePasswordMap.entries()) {
                                if (cleanCand.endsWith(pKey) || pKey.endsWith(cleanCand) || cleanCand.includes(pKey)) {
                                    effectivePassword = pVal;
                                    break;
                                }
                            }
                            if (effectivePassword) break;
                        }
                    }
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
                    appPassword: effectivePassword || 'nusantara!',
                    crmId: sqlC ? sqlC.id : null,
                    is_app_enabled: sqlC ? Boolean(sqlC.is_app_enabled) : false,
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
        let data = await client.write(command);
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

            const sqlCustomers = await Customer.findAll();
            const sqlMap = new Map();
            const phoneCustomerMap = new Map();

            sqlCustomers.forEach(c => {
                const json = c.toJSON();
                if (c.mikrotik_name) {
                    const key = `${String(c.server_id || '').toLowerCase()}-${String(c.mikrotik_name).toLowerCase().trim()}`;
                    sqlMap.set(key, json);
                    sqlMap.set(String(c.mikrotik_name).toLowerCase().trim(), json);
                }
                if (c.phone_number) {
                    const clean = c.phone_number.replace(/\D/g, '');
                    if (clean && clean.length >= 6) {
                        phoneCustomerMap.set(clean, json);
                        if (clean.length >= 8) {
                            phoneCustomerMap.set(clean.slice(-8), json);
                        }
                    }
                }
            });

            for (const item of data) {
                if (!item.name) continue;

                try {
                    // Map status
                    let status = 'active';
                    if (item.disabled === 'true' || item.disabled === true) status = 'disabled';

                    const itemKey = `${String(server.id).toLowerCase()}-${String(item.name).toLowerCase().trim()}`;
                    const nameKey = String(item.name).toLowerCase().trim();

                    let existing = sqlMap.get(itemKey) || sqlMap.get(nameKey);

                    if (!existing && item.comment) {
                        const phoneMatches = item.comment.match(/\d{6,15}/g) || [];
                        for (const candidate of phoneMatches) {
                            const cleanCand = candidate.replace(/\D/g, '');
                            const found = phoneCustomerMap.get(cleanCand) || phoneCustomerMap.get(cleanCand.slice(-8));
                            if (found) {
                                existing = found;
                                break;
                            }
                        }
                    }

                    if (existing && existing.id) {
                        const dbCust = await Customer.findByPk(existing.id);
                        if (dbCust) {
                            await dbCust.update({
                                profile: item.profile,
                                status: status,
                                comment: item.comment || dbCust.comment || '',
                                mikrotik_name: dbCust.mikrotik_name || item.name,
                                server_id: dbCust.server_id || server.id
                            });
                        }
                    } else {
                        // Extract phone from comment if available
                        let extractedPhone = null;
                        if (item.comment) {
                            const phoneMatches = item.comment.match(/\d{8,15}/g);
                            if (phoneMatches && phoneMatches.length > 0) {
                                extractedPhone = phoneMatches[0];
                            }
                        }

                        // Create new customer from Mikrotik
                        const newCust = await Customer.create({
                            server_id: server.id,
                            mikrotik_name: item.name,   // PPP Secret: name
                            name: item.name,             // store ppp secret name (username) here too
                            real_name: item.name,
                            phone_number: extractedPhone,
                            profile: item.profile,
                            status: status,
                            comment: item.comment || '', // PPP Secret: comment
                            password: 'nusantara!',
                            must_change_password: true
                        });
                        sqlMap.set(itemKey, newCust.toJSON());
                        sqlMap.set(nameKey, newCust.toJSON());
                    }
                } catch (err) {
                    console.error(`[Sync] Error updating secret ${item.name}:`, err.message);
                }
            }
            console.log(`[Sync] SQL Database updated.`);

            // [FIX] Merge SQL Data back into the Cache Response
            // Refresh sqlCustomers list after updates
            const updatedSqlCustomers = await Customer.findAll({ where: { server_id: server.id } });
            const freshSqlMap = new Map();
            updatedSqlCustomers.forEach(c => {
                const json = c.toJSON();
                freshSqlMap.set(String(c.mikrotik_name).toLowerCase().trim(), json);
                if (c.phone_number) {
                    const clean = c.phone_number.replace(/\D/g, '');
                    if (clean && clean.length >= 6) {
                        phoneCustomerMap.set(clean, json);
                        if (clean.length >= 8) {
                            phoneCustomerMap.set(clean.slice(-8), json);
                        }
                    }
                }
            });

            // 2. Enrich Mikrotik Data with all CRM fields including appPassword and crmId
            data = data.map(item => {
                const key = String(item.name).toLowerCase().trim();
                let sqlC = freshSqlMap.get(key);

                if (!sqlC && item.comment) {
                    const phoneMatches = item.comment.match(/\d{6,15}/g) || [];
                    for (const candidate of phoneMatches) {
                        const cleanCand = candidate.replace(/\D/g, '');
                        const found = phoneCustomerMap.get(cleanCand) || phoneCustomerMap.get(cleanCand.slice(-8));
                        if (found) {
                            sqlC = found;
                            break;
                        }
                    }
                }
                
                if (sqlC) {
                    return {
                        ...item,
                        crmId: sqlC.id,
                        realName: sqlC.real_name || '', 
                        whatsapp: sqlC.phone_number || '',
                        address: sqlC.address || '',
                        sub_area_id: sqlC.sub_area_id || '',
                        odpId: sqlC.odp_id || null, 
                        ktp: sqlC.ktp || '', 
                        coordinates: sqlC.coordinates || '',
                        installationDate: sqlC.installationDate || '',
                        activationDate: sqlC.activationDate || '',
                        photos: sqlC.photos || [],
                        ssidName: sqlC.ssidName || '',
                        ssidPassword: sqlC.ssidPassword || '',
                        signalLevel: sqlC.signalLevel || '',
                        appPassword: sqlC.password || 'nusantara!'
                    };
                }
                return {
                    ...item,
                    appPassword: 'nusantara!'
                };
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

        // Dynamically enrich secrets cache with live SQLite customer data
        if (resource === 'secrets' && Array.isArray(cacheData.data)) {
            const sqlCustomers = await Customer.findAll();
            const sqlMap = new Map();
            const phoneCustomerMap = new Map();

            sqlCustomers.forEach(c => {
                const json = c.toJSON();
                if (c.mikrotik_name) {
                    const key = `${String(c.server_id || '').toLowerCase()}-${String(c.mikrotik_name).toLowerCase().trim()}`;
                    sqlMap.set(key, json);
                    sqlMap.set(String(c.mikrotik_name).toLowerCase().trim(), json);
                }
                if (c.phone_number) {
                    const clean = c.phone_number.replace(/\D/g, '');
                    if (clean && clean.length >= 6) {
                        phoneCustomerMap.set(clean, json);
                        if (clean.length >= 8) {
                            phoneCustomerMap.set(clean.slice(-8), json);
                        }
                    }
                }
            });

            cacheData.data = cacheData.data.map(item => {
                const key = `${String(serverId).toLowerCase()}-${String(item.name).toLowerCase().trim()}`;
                const nameKey = String(item.name).toLowerCase().trim();
                let sqlC = sqlMap.get(key) || sqlMap.get(nameKey);

                if (!sqlC && item.comment) {
                    const phoneMatches = item.comment.match(/\d{6,15}/g) || [];
                    for (const candidate of phoneMatches) {
                        const cleanCand = candidate.replace(/\D/g, '');
                        const found = phoneCustomerMap.get(cleanCand) || phoneCustomerMap.get(cleanCand.slice(-8));
                        if (found) {
                            sqlC = found;
                            break;
                        }
                    }
                }

                if (sqlC) {
                    return {
                        ...item,
                        crmId: sqlC.id,
                        realName: sqlC.real_name || item.realName || '',
                        whatsapp: sqlC.phone_number || item.whatsapp || '',
                        address: sqlC.address || item.address || '',
                        sub_area_id: sqlC.sub_area_id || item.sub_area_id || '',
                        appPassword: sqlC.password || 'nusantara!',
                        ktp: sqlC.ktp || item.ktp || '',
                        coordinates: sqlC.coordinates || item.coordinates || '',
                        activationDate: sqlC.activationDate || item.activationDate || '',
                        installationDate: sqlC.installationDate || item.installationDate || '',
                        ssidName: sqlC.ssidName || item.ssidName || '',
                        ssidPassword: sqlC.ssidPassword || item.ssidPassword || '',
                        signalLevel: sqlC.signalLevel || item.signalLevel || ''
                    };
                }
                return {
                    ...item,
                    appPassword: item.appPassword || 'nusantara!'
                };
            });
        }

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

// --- Mikrotik Hotspot Management ---

// Helper: Connect to MikroTik and run command(s)
const runMikrotikCommand = async (serverId, commands) => {
    const server = await Server.findByPk(serverId);
    if (!server) throw new Error('Server not found');

    const portNumber = server.port ? parseInt(server.port, 10) : 8728;
    console.log(`[Hotspot API] Connecting to ${server.name} (${server.ip}:${portNumber})...`);

    const client = new RouterOSAPI({
        host: server.ip,
        port: portNumber,
        user: server.username,
        password: server.password,
        keepalive: false,
        timeout: 3
    });
    client.on('error', (err) => console.error(`[Hotspot] Client Error (${server.ip}:${portNumber}):`, err.message));

    try {
        await client.connect();
        const data = await client.write(commands);
        return data;
    } finally {
        try { await client.close(); } catch (e) {}
    }
};

// Get Hotspot Servers
app.post('/api/mikrotik/hotspot/servers', async (req, res) => {
    const { serverId } = req.body;
    if (!serverId) return res.status(400).json({ error: 'Missing serverId' });

    try {
        const data = await runMikrotikCommand(serverId, ['/ip/hotspot/print']);
        res.json(Array.isArray(data) ? data : []);
    } catch (e) {
        console.error('[Hotspot Servers]', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Get Hotspot Users
app.post('/api/mikrotik/hotspot/users', async (req, res) => {
    const { serverId } = req.body;
    if (!serverId) return res.status(400).json({ error: 'Missing serverId' });

    try {
        const data = await runMikrotikCommand(serverId, ['/ip/hotspot/user/print']);
        res.json(Array.isArray(data) ? data : []);
    } catch (e) {
        console.error('[Hotspot Users]', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Add Hotspot User
app.post('/api/mikrotik/hotspot/users/add', async (req, res) => {
    const { serverId, userData } = req.body;
    if (!serverId || !userData) return res.status(400).json({ error: 'Missing serverId or userData' });

    try {
        const command = ['/ip/hotspot/user/add'];
        Object.keys(userData).forEach(key => {
            if (userData[key] !== undefined && userData[key] !== null && userData[key] !== '') {
                command.push(`=${key}=${userData[key]}`);
            }
        });
        const data = await runMikrotikCommand(serverId, command);
        await logActivity(req, 'HOTSPOT_USER_ADD', { serverId, user: userData.name });
        res.json({ success: true, data });
    } catch (e) {
        console.error('[Hotspot User Add]', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Update Hotspot User
app.post('/api/mikrotik/hotspot/users/update', async (req, res) => {
    const { serverId, id, userData } = req.body;
    if (!serverId || !id) return res.status(400).json({ error: 'Missing serverId or id' });

    try {
        const command = ['/ip/hotspot/user/set', `=.id=${id}`];
        Object.keys(userData).forEach(key => {
            if (userData[key] !== undefined && userData[key] !== null) {
                command.push(`=${key}=${userData[key]}`);
            }
        });
        const data = await runMikrotikCommand(serverId, command);
        await logActivity(req, 'HOTSPOT_USER_UPDATE', { serverId, id, user: userData.name });
        res.json({ success: true, data });
    } catch (e) {
        console.error('[Hotspot User Update]', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Delete Hotspot User
app.post('/api/mikrotik/hotspot/users/delete', async (req, res) => {
    const { serverId, id, username } = req.body;
    if (!serverId || !id) return res.status(400).json({ error: 'Missing serverId or id' });

    try {
        const data = await runMikrotikCommand(serverId, ['/ip/hotspot/user/remove', `=.id=${id}`]);
        if (username) {
            await CustomerVoucher.update({ status: 'expired' }, { where: { voucher_code: username } }).catch(() => {});
        }
        await logActivity(req, 'HOTSPOT_USER_DELETE', { serverId, id, username });
        res.json({ success: true, data });
    } catch (e) {
        console.error('[Hotspot User Delete]', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Toggle (Enable/Disable) Hotspot User
app.post('/api/mikrotik/hotspot/users/toggle', async (req, res) => {
    const { serverId, id, disabled } = req.body;
    if (!serverId || !id) return res.status(400).json({ error: 'Missing serverId or id' });

    try {
        const data = await runMikrotikCommand(serverId, [
            '/ip/hotspot/user/set',
            `=.id=${id}`,
            `=disabled=${disabled ? 'yes' : 'no'}`
        ]);
        await logActivity(req, 'HOTSPOT_USER_TOGGLE', { serverId, id, disabled });
        res.json({ success: true, data });
    } catch (e) {
        console.error('[Hotspot User Toggle]', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Get Hotspot Active Sessions
app.post('/api/mikrotik/hotspot/active', async (req, res) => {
    const { serverId } = req.body;
    if (!serverId) return res.status(400).json({ error: 'Missing serverId' });

    try {
        const data = await runMikrotikCommand(serverId, ['/ip/hotspot/active/print']);
        res.json(Array.isArray(data) ? data : []);
    } catch (e) {
        console.error('[Hotspot Active]', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Kick/Disconnect Hotspot Active User
app.post('/api/mikrotik/hotspot/active/kick', async (req, res) => {
    const { serverId, id } = req.body;
    if (!serverId || !id) return res.status(400).json({ error: 'Missing serverId or id' });

    try {
        const data = await runMikrotikCommand(serverId, ['/ip/hotspot/active/remove', `=.id=${id}`]);
        await logActivity(req, 'HOTSPOT_USER_KICK', { serverId, id });
        res.json({ success: true, data });
    } catch (e) {
        console.error('[Hotspot Kick]', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Get Hotspot User Profiles
app.post('/api/mikrotik/hotspot/profiles', async (req, res) => {
    const { serverId } = req.body;
    if (!serverId) return res.status(400).json({ error: 'Missing serverId' });

    try {
        const data = await runMikrotikCommand(serverId, ['/ip/hotspot/user/profile/print']);
        res.json(Array.isArray(data) ? data : []);
    } catch (e) {
        console.error('[Hotspot Profiles]', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Batch Generate Hotspot Vouchers
app.post('/api/mikrotik/hotspot/vouchers/generate', async (req, res) => {
    const { serverId, vouchers } = req.body;
    if (!serverId || !Array.isArray(vouchers) || vouchers.length === 0) {
        return res.status(400).json({ error: 'Missing serverId or vouchers array' });
    }

    try {
        const server = await Server.findByPk(serverId);
        if (!server) throw new Error('Server not found');

        const portNumber = server.port ? parseInt(server.port, 10) : 8728;
        const client = new RouterOSAPI({
            host: server.ip,
            port: portNumber,
            user: server.username,
            password: server.password,
            keepalive: false,
            timeout: 30
        });
        await client.connect();

        const created = [];
        const errors = [];

        // Whitelist of valid mikrotik /ip/hotspot/user parameters
        const MIKROTIK_USER_PARAMS = new Set([
            'name', 'password', 'profile', 'server', 
            'limit-bytes-total', 'limit-bytes-in', 'limit-bytes-out',
            'limit-uptime', 'comment', 'disabled', 'email', 'routes'
        ]);

        for (const v of vouchers) {
            try {
                // Ensure customer is resolved and matched to the Customers table
                let matchedCustomerId = null;
                let customerRecord = null;

                // 1. Try finding customer by provided UUID
                if (v.customerId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.customerId)) {
                    customerRecord = await Customer.findByPk(v.customerId);
                    if (customerRecord) matchedCustomerId = customerRecord.id;
                }

                // 2. If not found, try finding by mikrotik_name (PPPoE / customer username) on this server
                if (!matchedCustomerId && v.customerUsername) {
                    customerRecord = await Customer.findOne({
                        where: {
                            server_id: server.id,
                            mikrotik_name: v.customerUsername
                        }
                    });
                    if (customerRecord) matchedCustomerId = customerRecord.id;
                }

                // 3. If not found, try finding by phone number if provided
                if (!matchedCustomerId && v.customerPhone && v.customerPhone.trim().length > 5) {
                    customerRecord = await Customer.findOne({
                        where: {
                            server_id: server.id,
                            phone_number: v.customerPhone.trim()
                        }
                    });
                    if (customerRecord) matchedCustomerId = customerRecord.id;
                }

                // 4. If customer is from an active user but doesn't exist yet in the Customers table, auto-create
                if (!matchedCustomerId && v.customerUsername) {
                    try {
                        const newCust = await Customer.create({
                            server_id: server.id,
                            mikrotik_name: v.customerUsername,
                            name: v.customerName || v.customerUsername,
                            real_name: v.customerName || v.customerUsername,
                            phone_number: v.customerPhone || null,
                            profile: v.profile || 'default',
                            status: 'active'
                        });
                        customerRecord = newCust;
                        matchedCustomerId = newCust.id;
                    } catch (custCreateErr) {
                        console.warn('[Auto Create Customer Warning]', custCreateErr.message);
                    }
                }

                // Append [CID:uuid] to router comment so MikroTik and DB are always cross-referenceable
                let mikrotikComment = v.comment || '';
                if (matchedCustomerId && !mikrotikComment.includes(`[CID:${matchedCustomerId}]`)) {
                    mikrotikComment = `[CID:${matchedCustomerId}] ${mikrotikComment}`.trim();
                }

                const command = ['/ip/hotspot/user/add'];
                Object.keys(v).forEach(k => {
                    if (k === 'comment') {
                        if (mikrotikComment) command.push(`=comment=${mikrotikComment}`);
                    } else if (MIKROTIK_USER_PARAMS.has(k) && v[k] !== undefined && v[k] !== null && v[k] !== '') {
                        command.push(`=${k}=${v[k]}`);
                    }
                });
                if (!v.comment && mikrotikComment) {
                    command.push(`=comment=${mikrotikComment}`);
                }

                await client.write(command);

                // Save to CustomerVoucher database for client-side access & future customer portal
                try {
                    const savedVoucher = await CustomerVoucher.create({
                        customer_id: matchedCustomerId || null,
                        customer_name: v.customerName || customerRecord?.name || customerRecord?.real_name || (v.comment ? v.comment.replace(/^\[.*?\]\s*/, '') : null),
                        customer_username: v.customerUsername || customerRecord?.mikrotik_name || null,
                        customer_phone: v.customerPhone || customerRecord?.phone_number || null,
                        sub_area_name: v.subAreaName || null,
                        server_id: server.id,
                        server_name: server.name,
                        voucher_code: v.name,
                        voucher_password: v.password || null,
                        profile: v.profile || 'default',
                        quota_gb: Number(v.quotaGb) || (v['limit-bytes-total'] ? Math.round(Number(v['limit-bytes-total']) / 1073741824) : 0),
                        validity: v.validity || v['limit-uptime'] || '30d',
                        status: 'active',
                        notes: mikrotikComment || null
                    });
                    created.push({ ...v, customerId: matchedCustomerId, dbId: savedVoucher.id });
                } catch (dbErr) {
                    console.error('[Hotspot Vouchers DB Save Error]', dbErr.message);
                    created.push({ ...v, customerId: matchedCustomerId });
                }
            } catch (err) {
                errors.push({ voucher: v.name, customerName: v.customerName, error: err.message });
            }
        }

        await client.close();

        await logActivity(req, 'HOTSPOT_VOUCHERS_GENERATE', {
            serverId,
            count: created.length,
            errorsCount: errors.length
        });

        res.json({
            success: true,
            total: vouchers.length,
            createdCount: created.length,
            created,
            errors
        });
    } catch (e) {
        console.error('[Hotspot Vouchers Generate]', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Query Customer Vouchers (Accessible by Client Portal & Admin)
app.get('/api/customer-vouchers', async (req, res) => {
    try {
        const { customerId, serverId, phone, status, limit } = req.query;
        const whereClause = {};

        if (customerId) whereClause.customer_id = customerId;
        if (serverId && serverId !== 'all') whereClause.server_id = serverId;
        if (phone) whereClause.customer_phone = phone;
        if (status && status !== 'all') whereClause.status = status;

        const parsedLimit = limit === 'all' ? undefined : (limit ? parseInt(limit, 10) : 1000);

        const vouchers = await CustomerVoucher.findAll({
            where: whereClause,
            include: [
                {
                    model: Customer,
                    attributes: ['id', 'name', 'real_name', 'mikrotik_name', 'phone_number', 'profile', 'address', 'sub_area_id'],
                    required: false
                },
                {
                    model: Server,
                    attributes: ['id', 'name', 'ip'],
                    required: false
                }
            ],
            order: [['createdAt', 'DESC']],
            limit: parsedLimit
        });

        res.json(vouchers);
    } catch (e) {
        console.error('[Get Customer Vouchers Error]', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Sync & Cache all Hotspot Users across ALL Servers into CustomerVouchers DB
app.post('/api/customer-vouchers/sync-all', async (req, res) => {
    try {
        const servers = await Server.findAll();
        let totalSynced = 0;
        let totalPurged = 0;
        const serverResults = [];

        for (const s of servers) {
            try {
                const hotspotUsers = await runMikrotikCommand(s.id, ['/ip/hotspot/user/print']).catch(() => null);
                
                if (hotspotUsers === null || !Array.isArray(hotspotUsers)) {
                    serverResults.push({ serverId: s.id, serverName: s.name, count: 0, purged: 0, success: false, error: 'Router unreachable' });
                    continue;
                }

                const activeUsers = await runMikrotikCommand(s.id, ['/ip/hotspot/active/print']).catch(() => []);
                const activeNames = new Set(Array.isArray(activeUsers) ? activeUsers.map(a => a.user) : []);

                // 1. Get all live voucher codes on this router
                const liveCodesSet = new Set(hotspotUsers.map(u => u.name).filter(Boolean));

                // 2. Fetch existing cached vouchers in DB for this server
                const existingDbVouchers = await CustomerVoucher.findAll({ where: { server_id: s.id } });

                // 3. Purge cache vouchers if they no longer exist on the MikroTik router
                let purgedCount = 0;
                for (const dbV of existingDbVouchers) {
                    if (!liveCodesSet.has(dbV.voucher_code)) {
                        await dbV.destroy();
                        purgedCount++;
                    }
                }
                totalPurged += purgedCount;

                // 4. Upsert/Update live router users into DB cache
                let count = 0;
                for (const u of hotspotUsers) {
                    if (!u.name || u.name === 'default-trial') continue;

                    let status = 'unused';
                    if (u.disabled === 'true' || u.disabled === 'yes' || u.disabled === true) {
                        status = 'expired';
                    } else if (activeNames.has(u.name)) {
                        status = 'active';
                    }

                    const existing = existingDbVouchers.find(v => v.voucher_code === u.name);

                    if (existing) {
                        await existing.update({
                            voucher_password: u.password || existing.voucher_password,
                            profile_name: u.profile || existing.profile_name,
                            comment: u.comment || existing.comment,
                            status: status
                        });
                    } else {
                        await CustomerVoucher.create({
                            server_id: s.id,
                            voucher_code: u.name,
                            voucher_password: u.password || '',
                            profile_name: u.profile || 'default',
                            comment: u.comment || '',
                            status: status
                        });
                    }
                    count++;
                }
                
                totalSynced += count;
                serverResults.push({ serverId: s.id, serverName: s.name, count, purged: purgedCount, success: true });
            } catch (err) {
                console.error(`[Voucher Sync Fail] Server ${s.name}:`, err.message);
                serverResults.push({ serverId: s.id, serverName: s.name, count: 0, purged: 0, success: false, error: err.message });
            }
        }

        res.json({
            success: true,
            totalSynced,
            totalPurged,
            servers: serverResults
        });
    } catch (e) {
        console.error('[Sync All Vouchers Error]', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Delete Batch Vouchers from Cache & MikroTik Router
app.post('/api/customer-vouchers/delete-batch', async (req, res) => {
    try {
        const { voucherIds } = req.body;
        if (!Array.isArray(voucherIds) || voucherIds.length === 0) {
            return res.status(400).json({ error: 'voucherIds list required' });
        }

        const vouchers = await CustomerVoucher.findAll({
            where: { id: voucherIds }
        });

        for (const v of vouchers) {
            if (v.server_id && v.voucher_code) {
                try {
                    const users = await runMikrotikCommand(v.server_id, ['/ip/hotspot/user/print', `?name=${v.voucher_code}`]).catch(() => []);
                    if (Array.isArray(users) && users.length > 0) {
                        for (const u of users) {
                            await runMikrotikCommand(v.server_id, ['/ip/hotspot/user/remove', `=.id=${u['.id']}`]).catch(() => {});
                        }
                    }
                } catch (err) {
                    console.warn(`[Delete Router User Warning] ${v.voucher_code}:`, err.message);
                }
            }
            try {
                await v.destroy();
            } catch (err) {
                console.error(`[Destroy Voucher DB Error] ${v.id}:`, err.message);
            }
        }

        // Force delete from DB cache as guaranteed cleanup fallback
        await CustomerVoucher.destroy({
            where: { id: voucherIds }
        }).catch(() => {});

        res.json({ success: true, count: voucherIds.length });
    } catch (e) {
        console.error('[Delete Batch Vouchers Error]', e.message);
        // Fallback force delete from DB cache
        try {
            if (req.body?.voucherIds && Array.isArray(req.body.voucherIds)) {
                await CustomerVoucher.destroy({ where: { id: req.body.voucherIds } });
            }
        } catch (_) {}
        res.json({ success: true, count: req.body?.voucherIds?.length || 0 });
    }
});

// Query Vouchers for Specific Customer ID / Username / Phone (Future Client Portal Ready)
app.get('/api/customers/:id/vouchers', async (req, res) => {
    try {
        const { id } = req.params;

        // Try finding the customer first if id matches UUID, mikrotik_name, or phone
        let targetCustomer = null;
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
            targetCustomer = await Customer.findByPk(id);
        } else {
            targetCustomer = await Customer.findOne({
                where: {
                    [Op.or]: [
                        { mikrotik_name: id },
                        { phone_number: id }
                    ]
                }
            });
        }

        const orConditions = [
            { customer_id: id },
            { customer_username: id }
        ];

        if (targetCustomer) {
            orConditions.push({ customer_id: targetCustomer.id });
            if (targetCustomer.mikrotik_name) {
                orConditions.push({ customer_username: targetCustomer.mikrotik_name });
            }
            if (targetCustomer.phone_number) {
                orConditions.push({ customer_phone: targetCustomer.phone_number });
            }
        }

        const vouchers = await CustomerVoucher.findAll({
            where: {
                [Op.or]: orConditions
            },
            include: [{
                model: Customer,
                attributes: ['id', 'name', 'real_name', 'mikrotik_name', 'phone_number', 'profile'],
                required: false
            }],
            order: [['createdAt', 'DESC']]
        });

        res.json({
            success: true,
            customer: targetCustomer ? {
                id: targetCustomer.id,
                name: targetCustomer.name,
                real_name: targetCustomer.real_name,
                username: targetCustomer.mikrotik_name,
                phone: targetCustomer.phone_number
            } : null,
            total: vouchers.length,
            vouchers
        });
    } catch (e) {
        console.error('[Get Customer ID Vouchers Error]', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Update or Inject Quota for Active/Existing User
app.post('/api/mikrotik/hotspot/users/set-quota', async (req, res) => {
    const { serverId, username, id, customerId, limitBytesTotal, limitUptime, comment } = req.body;
    if (!serverId || (!id && !username)) {
        return res.status(400).json({ error: 'Missing serverId and user identifier (id or username)' });
    }

    try {
        const server = await Server.findByPk(serverId);
        if (!server) throw new Error('Server not found');

        const client = new RouterOSAPI({
            host: server.ip,
            port: server.port || 8728,
            user: server.username,
            password: server.password,
            keepalive: false,
            timeout: 20
        });
        await client.connect();

        let targetId = id;
        let targetUsername = username;
        if (!targetId && username) {
            const findUser = await client.write(['/ip/hotspot/user/print', `?name=${username}`]);
            if (Array.isArray(findUser) && findUser.length > 0) {
                targetId = findUser[0]['.id'];
                targetUsername = findUser[0]['name'] || username;
            } else {
                await client.close();
                return res.status(404).json({ error: `User hotspot '${username}' tidak ditemukan di router` });
            }
        }

        // Resolve customer from DB
        let customerRecord = null;
        if (customerId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customerId)) {
            customerRecord = await Customer.findByPk(customerId);
        }
        if (!customerRecord && targetUsername) {
            customerRecord = await Customer.findOne({
                where: { server_id: server.id, mikrotik_name: targetUsername }
            });
        }
        // Auto-create Customer entry if user is on router but not yet in DB
        if (!customerRecord && targetUsername) {
            try {
                customerRecord = await Customer.create({
                    server_id: server.id,
                    mikrotik_name: targetUsername,
                    name: targetUsername,
                    real_name: targetUsername,
                    status: 'active'
                });
            } catch (ignored) {}
        }

        let updatedComment = comment || '';
        if (customerRecord && !updatedComment.includes(`[CID:${customerRecord.id}]`)) {
            updatedComment = `[CID:${customerRecord.id}] ${updatedComment}`.trim();
        }

        const command = ['/ip/hotspot/user/set', `=.id=${targetId}`];
        if (limitBytesTotal) command.push(`=limit-bytes-total=${limitBytesTotal}`);
        if (limitUptime) command.push(`=limit-uptime=${limitUptime}`);
        if (updatedComment) command.push(`=comment=${updatedComment}`);

        const result = await client.write(command);

        // Optionally reset counter so new quota starts fresh
        try {
            await client.write(['/ip/hotspot/user/reset-counters', `=.id=${targetId}`]);
        } catch (ignored) {}

        await client.close();

        // Record in CustomerVoucher history
        if (customerRecord || targetUsername) {
            try {
                const quotaGb = limitBytesTotal ? Math.round(Number(limitBytesTotal) / 1073741824) : 0;
                await CustomerVoucher.create({
                    customer_id: customerRecord?.id || null,
                    customer_name: customerRecord?.name || customerRecord?.real_name || targetUsername,
                    customer_username: targetUsername,
                    customer_phone: customerRecord?.phone_number || null,
                    server_id: server.id,
                    server_name: server.name,
                    voucher_code: targetUsername,
                    quota_gb: quotaGb,
                    validity: limitUptime || '30d',
                    status: 'active',
                    notes: updatedComment || 'Injeksi Kuota User Aktif'
                });
            } catch (recErr) {
                console.warn('[CustomerVoucher Injected Record Error]', recErr.message);
            }
        }

        await logActivity(req, 'HOTSPOT_USER_SET_QUOTA', {
            serverId,
            username: targetUsername || targetId,
            customerId: customerRecord?.id,
            limitBytesTotal,
            limitUptime
        });

        res.json({ success: true, customerId: customerRecord?.id, data: result });
    } catch (e) {
        console.error('[Hotspot Set Quota]', e.message);
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

        // If profile was changed from 'BELUM AKTIF' to any active package, automatically record activationDate
        if (profile !== undefined) {
            const oldProfile = existing[0]['profile'] || '';
            const isOldBelumAktif = oldProfile.toLowerCase().trim() === 'belum aktif';
            const isNewActive = profile.toLowerCase().trim() !== 'belum aktif';

            if (isOldBelumAktif && isNewActive) {
                const todayStr = new Date().toISOString().split('T')[0];
                const cleanName = String(name).toLowerCase().trim();
                console.log(`[Activation] Customer ${name} profile changed from "${oldProfile}" to "${profile}". Setting activationDate to ${todayStr}.`);

                const sqlCustomer = await Customer.findOne({
                    where: { server_id: serverId, mikrotik_name: cleanName }
                });

                if (sqlCustomer) {
                    await sqlCustomer.update({
                        profile: profile,
                        activationDate: todayStr
                    });
                }

                // Update JSON cache as well
                const db = getDB();
                const key = `${String(serverId).toLowerCase()}-${cleanName}`;
                if (db[key]) {
                    db[key].activationDate = todayStr;
                    saveDB(db);
                }
            } else if (profile) {
                // Keep profile attribute synced in SQL Customer
                const cleanName = String(name).toLowerCase().trim();
                await Customer.update(
                    { profile: profile },
                    { where: { server_id: serverId, mikrotik_name: cleanName } }
                );
            }
        }

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
        
        // 1. Try finding by Primary Key (ID) if not starting with '*' (Mikrotik ID)
        if (id && !String(id).startsWith('*')) {
            try {
                customer = await Customer.findByPk(id);
            } catch (e) { }
        }

        // 2. Fallback: Find by WhatsApp / Phone Number
        const phone = whatsapp || req.body.phone_number;
        if (!customer && phone) {
            const cleanPhone = String(phone).replace(/\D/g, '');
            if (cleanPhone && cleanPhone.length >= 6) {
                const phoneSuffix = cleanPhone.length >= 8 ? cleanPhone.slice(-8) : cleanPhone;
                customer = await Customer.findOne({
                    where: {
                        [Op.or]: [
                            { phone_number: phone },
                            { phone_number: cleanPhone },
                            { phone_number: { [Op.like]: `%${phoneSuffix}` } }
                        ]
                    }
                });
            }
        }

        // 3. Fallback: Find by Mikrotik Name + Server ID
        if (!customer && (req.body.name || req.body.username)) {
            const serverId = req.body.serverId;
            const mikrotikName = String(req.body.name || req.body.username).trim();

            const whereClause = {
                mikrotik_name: String(mikrotikName).toLowerCase().trim()
            };
            if (serverId) whereClause.server_id = serverId;

            customer = await Customer.findOne({ where: whereClause });

            // If still not found, search without server_id restriction
            if (!customer) {
                customer = await Customer.findOne({
                    where: {
                        mikrotik_name: String(mikrotikName).toLowerCase().trim()
                    }
                });
            }
        }

        // 4. Fallback: Find by Real Name
        if (!customer && realName) {
            customer = await Customer.findOne({
                where: {
                    real_name: String(realName).trim()
                }
            });
        }

        // 5. If still not found, create new Customer record in SQL with essential details
        if (!customer) {
            const mikrotikName = req.body.name || req.body.username || id;
            console.log(`[CRM] Customer ${mikrotikName} not found in SQL. Creating...`);
            customer = await Customer.create({
                mikrotik_name: String(mikrotikName).toLowerCase().trim(),
                server_id: req.body.serverId || null,
                real_name: realName || name || mikrotikName,
                phone_number: whatsapp || null,
                password: appPassword || 'nusantara!',
                must_change_password: false,
                status: 'active'
            });
        }

        if (!customer) {
            console.log(`[DEBUG] Customer lookup failed for ID: ${id}, ServerID: ${req.body.serverId}, Name: ${req.body.name}`);
            return res.status(404).json({ error: 'Customer not found (SQL Lookup Failed)' });
        }

        const appPassword = req.body.appPassword || req.body.app_password;

        // Update SQL fields
        const updateData = {
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
        };

        if (req.body.is_app_enabled !== undefined) {
            updateData.is_app_enabled = Boolean(req.body.is_app_enabled);
        }

        if (!customer.mikrotik_name && (req.body.name || req.body.username)) {
            updateData.mikrotik_name = String(req.body.name || req.body.username).toLowerCase().trim();
        }
        if (!customer.server_id && req.body.serverId) {
            updateData.server_id = req.body.serverId;
        }

        if (appPassword) {
            updateData.password = appPassword;
            updateData.must_change_password = false;
        }

        await customer.update(updateData);

        // Sync password across all accounts sharing the same phone number if appPassword was updated
        if (appPassword && customer.phone_number) {
            const cleanPhone = customer.phone_number.replace(/\D/g, '');
            const phoneSuffix = cleanPhone.length >= 8 ? cleanPhone.slice(-8) : cleanPhone;
            await Customer.update({
                password: appPassword,
                must_change_password: false
            }, {
                where: {
                    [Op.or]: [
                        { phone_number: customer.phone_number },
                        ...(phoneSuffix ? [
                            { phone_number: { [Op.like]: `%${phoneSuffix}` } },
                            { phone_number: cleanPhone }
                        ] : [])
                    ]
                }
            }).catch(e => console.error('[Password Sync Error]', e));
        }

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

// Get Customer Gallery (Aggregates Registration, Customer, and Ticket photos)
app.get('/api/customers/:id/gallery', async (req, res) => {
    const { id } = req.params;
    try {
        let photos = [];
        let customer;
        
        if (id && id.length > 10) {
            customer = await Customer.findByPk(id);
        }

        if (!customer && req.query.serverId && req.query.mikrotikName) {
            customer = await Customer.findOne({
                where: { server_id: req.query.serverId, mikrotik_name: String(req.query.mikrotikName).toLowerCase().trim() }
            });
        }

        const phoneNum = customer ? (customer.phone_number || (CACHE.customers && CACHE.customers[`${customer.server_id}-${customer.mikrotik_name}`]?.whatsapp)) : null;
        const normalizedPhone = phoneNum ? phoneNum.replace(/\D/g, '') : null;

        // 1. Customer Photos (Includes Registration if synced)
        if (customer && Array.isArray(customer.photos)) {
            photos = [...photos, ...customer.photos.map(url => ({ 
                url, 
                source: 'Customer Profile / Registration', 
                date: customer.installationDate || customer.activationDate || customer.createdAt 
            }))];
        }

        // 2. Registration Photos (Fallback/Explicit)
        const registrations = getRegistrationsDB() || [];
        const reg = registrations.find(r => 
            (normalizedPhone && r.phoneNumber && r.phoneNumber.replace(/\D/g, '') === normalizedPhone) ||
            (customer && customer.name && r.fullName.toLowerCase() === customer.name.toLowerCase())
        );

        if (reg && reg.installation && Array.isArray(reg.installation.photos)) {
            photos = [...photos, ...reg.installation.photos.map(url => ({ 
                url, 
                source: 'Registration', 
                date: reg.installation.finishDate || reg.createdAt 
            }))];
        }

        // 3. Ticket Photos
        const tickets = getTicketsDB() || [];
        const custTickets = tickets.filter(t => 
            (customer && t.customerId === customer.id) || 
            (normalizedPhone && t.customerPhone && t.customerPhone.replace(/\D/g, '') === normalizedPhone) ||
            (customer && t.customerName && t.customerName.toLowerCase() === customer.mikrotik_name.toLowerCase())
        );

        custTickets.forEach(t => {
            if (Array.isArray(t.photos)) {
                photos = [...photos, ...t.photos.map(url => ({ 
                    url, 
                    source: `Ticket ${t.ticketNumber || '#'+t.id.substring(0,6)}`, 
                    date: t.createdAt 
                }))];
            }
        });

        // Deduplicate URLs
        const uniquePhotos = [];
        const seen = new Set();
        for (const p of photos) {
            if (p.url && !seen.has(p.url)) {
                seen.add(p.url);
                uniquePhotos.push(p);
            }
        }

        // Sort by date descending
        uniquePhotos.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

        res.json({ success: true, gallery: uniquePhotos });
    } catch (e) {
        console.error('Error fetching gallery:', e);
        res.status(500).json({ error: 'Failed to fetch gallery' });
    }
});


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
                is_app_enabled: sqlData.is_app_enabled !== undefined ? Boolean(sqlData.is_app_enabled) : (metaMap[key]?.is_app_enabled !== undefined ? Boolean(metaMap[key].is_app_enabled) : false),
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

// Bulk Enable / Disable Customer App Access
app.post('/api/customers/bulk-app-access', async (req, res) => {
    const { customers, is_app_enabled, user } = req.body;

    if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) {
        return res.status(403).json({ error: 'Access denied. Authorized users only.' });
    }

    if (!Array.isArray(customers) || customers.length === 0) {
        return res.status(400).json({ error: 'No customers selected' });
    }

    try {
        const targetState = Boolean(is_app_enabled);
        let updatedCount = 0;

        for (const item of customers) {
            let customerRecord = null;
            if (item.crmId) {
                customerRecord = await Customer.findByPk(item.crmId);
            }
            
            if (!customerRecord && item.serverId && item.name) {
                customerRecord = await Customer.findOne({
                    where: {
                        server_id: item.serverId,
                        mikrotik_name: String(item.name).toLowerCase().trim()
                    }
                });
            }

            if (customerRecord) {
                await customerRecord.update({ is_app_enabled: targetState });
                updatedCount++;
            } else if (item.serverId && item.name) {
                customerRecord = await Customer.create({
                    server_id: item.serverId,
                    mikrotik_name: String(item.name).toLowerCase().trim(),
                    is_app_enabled: targetState,
                    status: 'active'
                });
                updatedCount++;
            }

            // Update JSON memory cache
            if (item.serverId && item.name) {
                const key = `${String(item.serverId).toLowerCase()}-${String(item.name).toLowerCase().trim()}`;
                CACHE.customers[key] = {
                    ...(CACHE.customers[key] || {}),
                    is_app_enabled: targetState,
                    crmId: customerRecord ? customerRecord.id : undefined
                };
            }
        }

        queueWrite('customers', CACHE.customers);
        logActivity(req, 'BULK_APP_ACCESS', `Set app access to ${targetState ? 'ENABLED' : 'DISABLED'} for ${updatedCount} customers.`);
        res.json({ success: true, count: updatedCount, message: `Berhasil mengubah akses aplikasi untuk ${updatedCount} pelanggan.` });
    } catch (e) {
        console.error('Error in bulk-app-access:', e);
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
            // Enforce GMT+7 (WIB) timezone boundaries for filtering
            const startDate = new Date(`${paymentDate}T00:00:00+07:00`);
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
            // Enforce GMT+7 (WIB) timezone boundaries for filtering
            const startDate = new Date(`${paymentDate}T00:00:00+07:00`);
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
    const { invoiceIds, status, method, user } = req.body;

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
        const invoices = await Invoice.findAll({ where: { id: invoiceIds } });
        const now = new Date();
        let updatedCount = 0;

        for (const inv of invoices) {
            if (status === 'PAID' && inv.status !== 'PAID') {
                await inv.update({ status: 'PAID' });
                updatedCount++;
                
                if (method) {
                    try {
                        await Payment.create({
                            invoice_id: inv.id,
                            amount: inv.amount,
                            method: method,
                            verified_at: now,
                            transaction_date: now
                        });
                    } catch (err) {
                        console.error('Error creating bulk payment:', err);
                    }
                }
                
                await InvoiceHistory.create({
                    invoice_id: inv.id,
                    user_name: req.body.user?.username || 'System',
                    action: 'PAYMENT',
                    details: `Bulk payment via ${method || 'Unknown'}`
                });
            } else if (status !== 'PAID' && inv.status !== status) {
                if (['UNPAID', 'INVALID', 'CANCELLED'].includes(status)) {
                    await Payment.destroy({ where: { invoice_id: inv.id } });
                }
                await inv.update({ status: status });
                updatedCount++;
                
                await InvoiceHistory.create({
                    invoice_id: inv.id,
                    user_name: req.body.user?.username || 'System',
                    action: 'STATUS_UPDATE',
                    details: `Status bulk updated to ${status}`
                });
            }
        }

        logActivity(req, 'BULK_UPDATE_INVOICES', `Updated ${updatedCount} invoices to ${status}`);
        res.json({ success: true, message: `Updated ${updatedCount} invoices to ${status}` });
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

app.get('/api/test-payments', async (req, res) => {
    try {
        const payments = await Payment.findAll({ order: [['transaction_date', 'DESC']], limit: 10 });
        res.json({ payments });
    } catch (e) {
        res.json({ error: e.message });
    }
});

// --- SumoPod Payment Gateway Integration ---

const SUMOPOD_KEYS = {
    prod: '4cbae0ec94eeb5435edca9d43bf2be874638f8a7f9fbb24933beb572a848a6ad',
    dev: '493ace70dd0eaa77aaf8218334b67c0c84c128ede451d185879e050bdb675ce6'
};

const SUMOPOD_MODE = (process.env.SUMOPOD_MODE || 'prod').toLowerCase();
const SUMOPOD_API_KEY = process.env.SUMOPOD_API_KEY || SUMOPOD_KEYS.prod;
const SUMOPOD_BASE_URL = process.env.SUMOPOD_BASE_URL || 'https://api-pay.sumopod.com/api/v1';

// 1. Create SumoPod Payment Link
app.post('/api/billing/sumopod/create-payment', async (req, res) => {
    try {
        const { invoiceId, paymentMethod, successReturnUrl, cancelReturnUrl } = req.body;
        if (!invoiceId) {
            return res.status(400).json({ error: 'invoiceId mandatory' });
        }

        const invoice = await Invoice.findByPk(invoiceId, {
            include: [{ model: Customer }]
        });

        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        if (invoice.status === 'PAID') {
            return res.status(400).json({ error: 'Invoice ini sudah lunas' });
        }

        const amount = Math.round(Number(invoice.amount));
        const orderId = `INV-${invoice.id}`;

        const payload = {
            order_id: orderId,
            amount: amount,
            currency: 'IDR',
            expires_in_hours: 24,
            payment_method_type_code: paymentMethod || 'QRIS'
        };

        if (successReturnUrl) payload.success_return_url = successReturnUrl;
        if (cancelReturnUrl) payload.cancel_return_url = cancelReturnUrl;

        // Default to PROD key as requested, with fallback to DEV key
        const primaryKey = process.env.SUMOPOD_API_KEY || SUMOPOD_KEYS.prod;
        const fallbackKey = primaryKey === SUMOPOD_KEYS.prod ? SUMOPOD_KEYS.dev : SUMOPOD_KEYS.prod;

        const makeSumopodRequest = async (apiKey) => {
            const modeName = apiKey === SUMOPOD_KEYS.prod ? 'LIVE PROD' : 'DEV SANDBOX';
            console.log(`[SUMOPOD (${modeName})] Attempting create-payment for Invoice ${orderId}, Amount: ${amount}...`);
            try {
                const res = await fetch(`${SUMOPOD_BASE_URL}/payments`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Api-Key': apiKey,
                        'x-api-key': apiKey,
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify(payload)
                });
                const resData = await res.json().catch(() => null);
                return { status: res.status, ok: res.ok, data: resData, mode: modeName };
            } catch (err) {
                return { status: 500, ok: false, data: { error: err.message }, mode: modeName };
            }
        };

        let result = await makeSumopodRequest(primaryKey);

        // Fallback retry if primary key returns 401/403 Unauthorized
        if ((result.status === 401 || result.status === 403) && !process.env.SUMOPOD_API_KEY && primaryKey !== fallbackKey) {
            console.log(`[SUMOPOD] Primary key (${result.mode}) returned status ${result.status}, retrying with fallback key...`);
            result = await makeSumopodRequest(fallbackKey);
        }

        if (result.ok && result.data && result.data.payment_link_url) {
            const data = result.data;
            console.log(`[SUMOPOD SUCCESS (${result.mode})] Payment ID: ${data.payment_id}, Link: ${data.payment_link_url}`);

            await InvoiceHistory.create({
                invoice_id: invoice.id,
                user_name: 'System',
                action: 'SUMOPOD_LINK_CREATED',
                details: `Tautan pembayaran QRIS (SumoPod - ${result.mode}) dibuat: ${data.payment_link_url}`
            }).catch(() => {});

            return res.json({
                success: true,
                payment_id: data.payment_id,
                payment_link_url: data.payment_link_url,
                order_id: data.order_id || orderId,
                amount: data.amount || amount,
                fee: data.fee,
                net_amount: data.net_amount,
                expires_at: data.expires_at,
                status: data.status,
                mode: result.mode
            });
        }

        // If SumoPod API returns 401 Unauthorized or error, provide fallback sandbox link for dev mode
        console.warn(`[SUMOPOD API NOTICE] API returned ${result.status}:`, result.data);

        // Demo/Sandbox Fallback Link for Local Testing when API Key is not yet authorized by SumoPod server
        const host = req.get('host') || 'localhost:5000';
        const protocol = req.protocol || 'http';
        const demoPaymentId = `demo_${invoice.id}_${Date.now()}`;
        const demoPaymentUrl = `${protocol}://${host}/api/billing/sumopod/demo-checkout/${invoice.id}`;

        await InvoiceHistory.create({
            invoice_id: invoice.id,
            user_name: 'System',
            action: 'SUMOPOD_LINK_CREATED_DEMO',
            details: `Tautan pembayaran QRIS (SumoPod Demo Link) dibuat: ${demoPaymentUrl}`
        }).catch(() => {});

        res.json({
            success: true,
            is_demo: true,
            payment_id: demoPaymentId,
            payment_link_url: demoPaymentUrl,
            order_id: orderId,
            amount: amount,
            status: 'PENDING',
            message: 'Tautan QRIS SumoPod (Demo Local) berhasil dibuat.'
        });
    } catch (e) {
        console.error('[SUMOPOD EXCEPTION]', e);
        res.status(500).json({ error: e.message });
    }
});

// Interactive Local Demo Checkout Page for SumoPod Testing
app.get('/api/billing/sumopod/demo-checkout/:invoiceId', async (req, res) => {
    try {
        const { invoiceId } = req.params;
        const invoice = await Invoice.findByPk(invoiceId, { include: [{ model: Customer }] });
        if (!invoice) return res.status(404).send('Invoice not found');

        const customerName = invoice.Customer ? (invoice.Customer.name || invoice.Customer.username) : 'Pelanggan';
        const formattedAmount = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(invoice.amount);

        const html = `
        <!DOCTYPE html>
        <html lang="id">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>SumoPod Payment Gateway Simulator</title>
            <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-slate-900 text-slate-100 flex items-center justify-center min-h-screen p-4">
            <div class="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl text-center space-y-5">
                <div class="flex items-center justify-center gap-2">
                    <span class="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">SumoPod Pay</span>
                    <span class="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">SANDBOX SIMULATOR</span>
                </div>

                <div class="border-t border-b border-slate-700 py-3 space-y-1">
                    <p class="text-xs text-slate-400">Total Tagihan (Invoice #${invoice.id})</p>
                    <p class="text-3xl font-extrabold text-white">${formattedAmount}</p>
                    <p class="text-sm text-slate-300 font-medium">Customer: ${customerName}</p>
                    <p class="text-xs text-slate-400">Status: <span id="statusBadge" class="font-semibold ${invoice.status === 'PAID' ? 'text-emerald-400' : 'text-amber-400'}">${invoice.status}</span></p>
                </div>

                <div class="bg-white p-4 rounded-xl inline-block shadow-inner">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=00020101021226670016COM.SUMOPOD.WWW01189360091400000000010215INV-${invoice.id}5204581253033605802ID5910SumoPodPay" alt="QRIS Code" class="w-48 h-48 mx-auto" />
                    <p class="text-slate-800 font-bold text-xs mt-2 tracking-widest">SCAN QRIS SUMOPOD</p>
                </div>

                ${invoice.status === 'PAID' ? `
                    <div class="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3 rounded-lg text-sm font-medium">
                        ✓ Tagihan ini sudah LUNAS
                    </div>
                ` : `
                    <button id="payBtn" onclick="simulatePayment()" class="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2">
                        Simulasi Bayar QRIS (Lunas & Auto Enable Akun)
                    </button>
                `}

                <p class="text-xs text-slate-500">Halaman simulasi pembayaran lokal untuk pengujian integrasi SumoPod.</p>
            </div>

            <script>
                async function simulatePayment() {
                    const btn = document.getElementById('payBtn');
                    btn.disabled = true;
                    btn.innerText = 'Memproses Pembayaran...';

                    try {
                        const res = await fetch('/api/webhooks/sumopod', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                event_type: 'payment.completed',
                                event: 'payment.completed',
                                data: {
                                    payment_id: 'demo_pay_${invoice.id}_' + Date.now(),
                                    order_id: 'INV-${invoice.id}',
                                    amount: ${invoice.amount},
                                    status: 'COMPLETED'
                                }
                            })
                        });
                        const result = await res.json();
                        if (res.ok && result.success) {
                            alert('✓ Pembayaran Berhasil! Tagihan lunas & akun pelanggan otomatis di-enable.');
                            window.location.reload();
                        } else {
                            alert('Gagal simulasi: ' + (result.error || 'Unknown error'));
                            btn.disabled = false;
                            btn.innerText = 'Simulasi Bayar QRIS (Lunas & Auto Enable Akun)';
                        }
                    } catch (err) {
                        alert('Error: ' + err.message);
                        btn.disabled = false;
                        btn.innerText = 'Simulasi Bayar QRIS (Lunas & Auto Enable Akun)';
                    }
                }
            </script>
        </body>
        </html>
        `;

        res.send(html);
    } catch (e) {
        res.status(500).send('Server Error: ' + e.message);
    }
});

// Helper to verify Svix HMAC Signatures for SumoPod Webhooks
function verifySumopodSvixSignature(secret, svixId, svixTimestamp, svixSignature, rawBodyStr) {
    if (!secret || !svixId || !svixTimestamp || !svixSignature) return true;
    try {
        const secretBytes = Buffer.from(secret.replace("whsec_", ""), "base64");
        const signedContent = `${svixId}.${svixTimestamp}.${rawBodyStr}`;
        const expectedSignature = crypto
            .createHmac("sha256", secretBytes)
            .update(signedContent)
            .digest("base64");
        const signatures = svixSignature.split(" ").map((s) => s.split(",")[1] || s);
        return signatures.includes(expectedSignature);
    } catch (e) {
        console.error('[SUMOPOD SVIX VERIFY ERROR]', e.message);
        return false;
    }
}

// 2. SumoPod Webhook Receiver Endpoint
const handleSumopodWebhook = async (req, res) => {
    try {
        const receivedToken = req.headers['x-webhook-token'];
        const expectedToken = process.env.WEBHOOK_TOKEN || process.env.SUMOPOD_WEBHOOK_TOKEN;
        
        if (expectedToken && receivedToken && expectedToken !== receivedToken) {
            console.warn('[SUMOPOD WEBHOOK UNAUTHORIZED] Invalid webhook token');
            return res.status(401).send('Invalid webhook token');
        }

        // Svix Signature Check if WEBHOOK_SECRET is provided
        const webhookSecret = process.env.WEBHOOK_SECRET || process.env.SUMOPOD_WEBHOOK_SECRET;
        if (webhookSecret) {
            const svixId = req.headers['svix-id'];
            const svixTimestamp = req.headers['svix-timestamp'];
            const svixSignature = req.headers['svix-signature'];
            const rawBodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

            if (!verifySumopodSvixSignature(webhookSecret, svixId, svixTimestamp, svixSignature, rawBodyStr)) {
                console.warn('[SUMOPOD WEBHOOK UNAUTHORIZED] Invalid Svix HMAC signature');
                return res.status(401).send('Invalid signature');
            }
        }

        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const data = body.data || body;
        const eventType = body.event_type || body.event || (data.status === 'COMPLETED' || data.status === 'PAID' ? 'payment.completed' : null);

        console.log(`[SUMOPOD WEBHOOK RECEIVED] Event: ${eventType}`, data);

        if (!eventType || !data) {
            return res.status(200).json({ success: true, message: 'No event data to process' });
        }

        if (eventType === 'payment.completed') {
            const orderId = data.order_id;
            const paymentId = data.payment_id;
            const amount = data.amount;

            if (!orderId) {
                console.warn('[SUMOPOD WEBHOOK] Missing order_id in data');
                return res.status(200).send('OK');
            }

            // Find Invoice by Primary Key or stripped INV- prefix
            const cleanId = String(orderId).replace(/^INV-/, '');
            let invoice = await Invoice.findByPk(cleanId) || await Invoice.findByPk(orderId) || await Invoice.findOne({ where: { id: cleanId } });

            if (!invoice) {
                console.error(`[SUMOPOD WEBHOOK] Invoice not found for order_id: ${orderId} (cleanId: ${cleanId})`);
                return res.status(200).send('OK (Invoice not found)');
            }

            if (invoice.status !== 'PAID') {
                const transactionDate = data.completed_at ? new Date(data.completed_at) : new Date();

                invoice.status = 'PAID';
                await invoice.save();

                // Create Payment record
                const payment = await Payment.create({
                    invoice_id: invoice.id,
                    amount: amount || invoice.amount,
                    method: data.payment_method ? `SumoPod (${String(data.payment_method).toUpperCase()})` : 'SumoPod QRIS',
                    proof_url: paymentId ? `https://pay.sumopod.com/pay/${paymentId}` : null,
                    verified_at: transactionDate,
                    transaction_date: transactionDate
                });

                // Create Audit Log
                await InvoiceHistory.create({
                    invoice_id: invoice.id,
                    user_name: 'SumoPod Gateway',
                    action: 'PAYMENT_COMPLETED',
                    details: `Pembayaran QRIS SumoPod sebesar Rp${amount || invoice.amount} sukses. Payment ID: ${paymentId}`,
                    timestamp: transactionDate
                });

                console.log(`[SUMOPOD WEBHOOK SUCCESS] Invoice ${invoice.id} marked as PAID. Payment record ID: ${payment.id}`);

                // Auto-Enable Customer Account if it was disabled / isolated / blocked
                if (invoice.customer_id) {
                    try {
                        const customer = await Customer.findByPk(invoice.customer_id);
                        if (customer) {
                            let needsUpdate = false;
                            const updates = {};

                            if (customer.status === 'disabled' || customer.status === 'isolated') {
                                updates.status = 'active';
                                needsUpdate = true;
                            }
                            if (!customer.is_app_enabled) {
                                updates.is_app_enabled = true;
                                needsUpdate = true;
                            }

                            if (needsUpdate) {
                                await customer.update(updates);
                                console.log(`[SUMOPOD WEBHOOK AUTO-ENABLE] Customer ${customer.id} (${customer.mikrotik_name}) enabled automatically in SQL.`);

                                // Enable Mikrotik PPP secret if disabled on router
                                if (customer.server_id && customer.mikrotik_name) {
                                    try {
                                        const server = await Server.findByPk(customer.server_id);
                                        if (server) {
                                            const client = new RouterOSAPI({
                                                host: server.ip,
                                                port: server.port || 8728,
                                                user: server.username,
                                                password: server.password,
                                                timeout: 3
                                            });
                                            client.on('error', () => {});
                                            await client.connect();
                                            
                                            const secrets = await client.write('/ppp/secret/print', [
                                                `?name=${customer.mikrotik_name}`
                                            ]);
                                            
                                            if (Array.isArray(secrets) && secrets.length > 0) {
                                                const sec = secrets[0];
                                                if (sec.disabled === 'true' || sec.disabled === true) {
                                                    await client.write('/ppp/secret/set', [
                                                        `=.id=${sec['.id']}`,
                                                        '=disabled=false'
                                                    ]);
                                                    console.log(`[SUMOPOD MIKROTIK UNBLOCK] Secret ${customer.mikrotik_name} enabled on router ${server.name}`);
                                                }
                                            }
                                            await client.close();

                                            // Sync secrets cache
                                            await MikrotikApi.syncSecrets(server).catch(() => {});
                                        }
                                    } catch (mikrotikErr) {
                                        console.warn('[SUMOPOD MIKROTIK UNBLOCK WARNING]', mikrotikErr.message);
                                    }
                                }

                                // Update Memory Cache
                                const key = `${String(customer.server_id).toLowerCase()}-${String(customer.mikrotik_name).toLowerCase().trim()}`;
                                if (CACHE.customers && CACHE.customers[key]) {
                                    CACHE.customers[key].status = 'active';
                                    CACHE.customers[key].is_app_enabled = true;
                                }
                            } else {
                                console.log(`[SUMOPOD WEBHOOK] Customer ${customer.id} is already enabled & active. No status change needed.`);
                            }
                        }
                    } catch (custErr) {
                        console.error('[SUMOPOD AUTO-ENABLE ERROR]', custErr);
                    }
                }
            } else {
                console.log(`[SUMOPOD WEBHOOK] Invoice ${invoice.id} was already marked as PAID.`);
            }
        } else if (event_type === 'payment.expired' || event_type === 'payment.failed') {
            const orderId = data.order_id;
            const paymentId = data.payment_id;
            if (orderId) {
                const invoice = await Invoice.findByPk(orderId).catch(() => null);
                if (invoice) {
                    await InvoiceHistory.create({
                        invoice_id: invoice.id,
                        user_name: 'SumoPod Gateway',
                        action: event_type === 'payment.expired' ? 'SUMOPOD_LINK_EXPIRED' : 'SUMOPOD_PAYMENT_FAILED',
                        details: `Sesi pembayaran online SumoPod (Payment ID: ${paymentId}) ${event_type === 'payment.expired' ? 'kadaluwarsa (24 jam)' : 'gagal'}.`,
                        timestamp: new Date()
                    }).catch(() => {});
                    console.log(`[SUMOPOD WEBHOOK] Recorded ${event_type} for Invoice ${invoice.id}`);
                }
            }
        }

        res.status(200).json({ success: true, message: 'Webhook event processed successfully' });
    } catch (e) {
        console.error('[SUMOPOD WEBHOOK ERROR]', e);
        res.status(500).json({ error: e.message });
    }
};

app.post('/api/webhooks/sumopod', handleSumopodWebhook);
app.post('/api/billing/webhook/sumopod', handleSumopodWebhook);

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

// --- Customer Portal (GigaNusa App) Auth & API ---

// Customer Login via Phone Number & Password
app.post('/api/customer-auth/login', async (req, res) => {
    try {
        let { phone, password } = req.body;
        if (!phone || !password) {
            return res.status(400).json({ error: 'Nomor HP dan kata sandi wajib diisi' });
        }

        phone = String(phone).trim();
        const inputPassword = String(password).trim();

        // Normalize phone variations (08... -> 628... or match endsWith)
        const cleanPhone = phone.replace(/\D/g, '');
        const phoneSuffix = cleanPhone.length >= 8 ? cleanPhone.slice(-8) : (cleanPhone.length >= 6 ? cleanPhone : null);

        const whereConditions = [
            { phone_number: phone },
            { mikrotik_name: phone },
            { mikrotik_name: phone.toLowerCase() }
        ];
        if (cleanPhone) {
            whereConditions.push({ phone_number: cleanPhone });
            whereConditions.push({ mikrotik_name: cleanPhone });
        }
        if (phoneSuffix) {
            whereConditions.push({ phone_number: { [Op.like]: `%${phoneSuffix}%` } });
        }

        const candidateCustomers = await Customer.findAll({
            where: {
                [Op.or]: whereConditions
            }
        });

        if (!candidateCustomers || candidateCustomers.length === 0) {
            console.log(`[CUSTOMER LOGIN FAIL] Phone/User "${phone}" (clean: ${cleanPhone}) not found in DB`);
            return res.status(401).json({ error: 'Nomor HP atau Username tidak terdaftar sebagai pelanggan' });
        }

        // Find candidate(s) with matching password
        const passwordMatches = candidateCustomers.filter(c => {
            const pwd = (c.password || 'nusantara!').trim();
            return pwd === inputPassword;
        });

        if (passwordMatches.length === 0) {
            console.log(`[CUSTOMER LOGIN PWD FAIL] Found ${candidateCustomers.length} candidate accounts for "${phone}", but none matched input password "${inputPassword}"`);
            return res.status(401).json({ error: 'Kata sandi salah.' });
        }

        const { selectedCustomerId } = req.body;

        let customer = null;
        if (selectedCustomerId) {
            customer = passwordMatches.find(c => String(c.id) === String(selectedCustomerId));
        }

        if (!customer) {
            if (passwordMatches.length > 1) {
                const enabledAccounts = passwordMatches.filter(c => Boolean(c.is_app_enabled));
                if (enabledAccounts.length === 0) {
                    console.log(`[CUSTOMER LOGIN BLOCKED] All ${passwordMatches.length} candidate accounts for "${phone}" are disabled for app access.`);
                    return res.status(403).json({ error: 'Akun anda belum di aktivasi, mohon hubungi admin' });
                }

                const servers = await Server.findAll();
                const serverMap = new Map(servers.map(s => [s.id, s.name]));

                const accountOptions = passwordMatches.map(c => ({
                    id: c.id,
                    name: c.mikrotik_name || c.name || 'Pelanggan',
                    real_name: c.real_name || c.name || 'Pelanggan',
                    phone_number: c.phone_number || phone,
                    server_id: c.server_id,
                    server_name: serverMap.get(c.server_id) || 'Router Server',
                    profile: c.profile || 'Reguler',
                    address: c.address || '',
                    status: c.status || 'active',
                    is_app_enabled: Boolean(c.is_app_enabled)
                }));

                console.log(`[CUSTOMER LOGIN MULTI] Found ${accountOptions.length} matching accounts for ${phone}. Prompting user to select.`);
                return res.json({
                    success: false,
                    multipleAccounts: true,
                    message: 'Nomor HP Anda terdaftar di beberapa lokasi/server. Silakan pilih akun yang ingin diakses:',
                    accounts: accountOptions
                });
            } else {
                customer = passwordMatches[0];
            }
        }

        if (!customer || !customer.is_app_enabled) {
            console.log(`[CUSTOMER LOGIN BLOCKED] Customer ID: ${customer?.id} App Access is disabled.`);
            return res.status(403).json({ error: 'Akun anda belum di aktivasi, mohon hubungi admin' });
        }

        console.log(`[CUSTOMER LOGIN SUCCESS] Matched Customer ID: ${customer.id}, Name: ${customer.name || customer.real_name}, Server ID: ${customer.server_id}`);

        // Generate Customer Token / Session
        const token = 'cust_' + crypto.randomUUID();
        const sessions = getSessionsDB();
        sessions[token] = {
            customerId: customer.id,
            phone: customer.phone_number,
            name: customer.real_name || customer.name || 'Pelanggan',
            role: 'customer',
            createdAt: new Date().toISOString()
        };
        saveSessionsDB(sessions);

        // Sanitize customer data (STRICT: NO MikroTik password / router technical info)
        const safeCustomer = {
            id: customer.id,
            name: customer.name || 'Pelanggan',
            real_name: customer.real_name || customer.name || 'Pelanggan',
            phone_number: customer.phone_number,
            address: customer.address || '',
            profile: customer.profile || 'Reguler',
            status: customer.status || 'active',
            activationDate: customer.activationDate || null,
            sub_area_id: customer.sub_area_id || null,
            mustChangePassword: customer.must_change_password !== false
        };

        logActivity(req, 'CUSTOMER_LOGIN', `Customer ${safeCustomer.name} (${customer.phone_number}) logged in`);

        res.json({
            success: true,
            token,
            customer: safeCustomer,
            mustChangePassword: customer.must_change_password !== false
        });
    } catch (error) {
        console.error('[Customer Auth Error]', error);
        res.status(500).json({ error: 'Terjadi kesalahan sistem saat login: ' + error.message });
    }
});

// Customer Force Change Password
app.post('/api/customer-auth/change-password', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const { customerId, oldPassword, newPassword } = req.body;

        if (!newPassword || newPassword.length < 4) {
            return res.status(400).json({ error: 'Kata sandi baru minimal 4 karakter' });
        }

        let targetCustomer = null;
        if (customerId) {
            targetCustomer = await Customer.findByPk(customerId);
        } else if (authHeader) {
            const token = authHeader.split(' ')[1];
            const sessions = getSessionsDB();
            const session = sessions[token];
            if (session && session.customerId) {
                targetCustomer = await Customer.findByPk(session.customerId);
            }
        }

        if (!targetCustomer) {
            return res.status(404).json({ error: 'Data pelanggan tidak ditemukan' });
        }

        // Verify old password if provided
        const currentPassword = targetCustomer.password || 'nusantara!';
        if (oldPassword && oldPassword !== currentPassword) {
            return res.status(400).json({ error: 'Kata sandi saat ini tidak cocok' });
        }

        // Prevent setting to the default password again
        if (newPassword === 'nusantara!') {
            return res.status(400).json({ error: 'Kata sandi baru tidak boleh menggunakan kata sandi bawaan (nusantara!)' });
        }

        await targetCustomer.update({
            password: newPassword,
            must_change_password: false
        });

        // Sync password across all accounts sharing the same phone number
        if (targetCustomer.phone_number) {
            const cleanPhone = targetCustomer.phone_number.replace(/\D/g, '');
            const phoneSuffix = cleanPhone.length >= 8 ? cleanPhone.slice(-8) : cleanPhone;
            await Customer.update({
                password: newPassword,
                must_change_password: false
            }, {
                where: {
                    [Op.or]: [
                        { phone_number: targetCustomer.phone_number },
                        ...(phoneSuffix ? [
                            { phone_number: { [Op.like]: `%${phoneSuffix}` } },
                            { phone_number: cleanPhone }
                        ] : [])
                    ]
                }
            }).catch(e => console.error('[Password Sync Error]', e));
        }

        logActivity(req, 'CUSTOMER_CHANGE_PWD', `Customer ${targetCustomer.id} changed password successfully`);

        res.json({
            success: true,
            message: 'Kata sandi berhasil diperbarui'
        });
    } catch (error) {
        console.error('[Customer Change Password Error]', error);
        res.status(500).json({ error: 'Gagal memperbarui sandi: ' + error.message });
    }
});

// Customer Dashboard API (Aggregates Profile, Invoices, Vouchers)
function parseMikrotikDuration(str) {
    if (!str || typeof str !== 'string') return 0;
    let seconds = 0;
    const dMatch = str.match(/(\d+)d/);
    if (dMatch) seconds += parseInt(dMatch[1], 10) * 86400;
    const hMatch = str.match(/(\d+)h/);
    if (hMatch) seconds += parseInt(hMatch[1], 10) * 3600;
    const mMatch = str.match(/(\d+)m/);
    if (mMatch) seconds += parseInt(mMatch[1], 10) * 60;
    const sMatch = str.match(/(\d+)s/);
    if (sMatch) seconds += parseInt(sMatch[1], 10);
    const timeMatch = str.match(/(\d{2}):(\d{2}):(\d{2})/);
    if (timeMatch) {
        seconds += parseInt(timeMatch[1], 10) * 3600 + parseInt(timeMatch[2], 10) * 60 + parseInt(timeMatch[3], 10);
    }
    return seconds;
}

app.get('/api/customer-portal/dashboard', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const { customerId } = req.query;

        let targetId = customerId;
        if (!targetId && authHeader) {
            const token = authHeader.split(' ')[1];
            const sessions = getSessionsDB();
            const session = sessions[token];
            if (session) targetId = session.customerId;
        }

        if (!targetId) {
            return res.status(401).json({ error: 'Unauthorized: customerId or token required' });
        }

        const customer = await Customer.findByPk(targetId, {
            include: [{ model: Server }]
        });
        if (!customer) {
            return res.status(404).json({ error: 'Pelanggan tidak ditemukan' });
        }

        // --- Live Package & Status Sync ---
        // Ensure customer.profile reflects the latest package from Mikrotik cache or router
        let currentProfile = customer.profile || 'Standard';
        let currentStatus = customer.status || 'active';

        try {
            if (customer.server_id && customer.mikrotik_name) {
                // 1. First check sync_cache file for this server
                const cachePath = getCachePath(customer.server_id, 'secrets');
                if (fs.existsSync(cachePath)) {
                    try {
                        const cacheRaw = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
                        const secretsList = Array.isArray(cacheRaw) ? cacheRaw : (cacheRaw.data || []);
                        const foundSecret = secretsList.find(s => 
                            String(s.name).toLowerCase().trim() === String(customer.mikrotik_name).toLowerCase().trim()
                        );
                        if (foundSecret) {
                            if (foundSecret.profile) currentProfile = foundSecret.profile;
                            if (foundSecret.disabled === true || foundSecret.disabled === 'true') {
                                currentStatus = 'disabled';
                            } else {
                                currentStatus = 'active';
                            }
                        }
                    } catch (errCache) { }
                }

                // If profile changed, update Customer record in database
                if (currentProfile !== customer.profile || currentStatus !== customer.status) {
                    await customer.update({
                        profile: currentProfile,
                        status: currentStatus
                    });
                }
            }
        } catch (syncErr) {
            console.warn('[Dashboard] Live profile sync warning:', syncErr.message);
        }

        // Resolve Sub Area Name from CACHE.subAreas
        const subAreas = CACHE.subAreas || [];
        const subAreaObj = subAreas.find(s => s.id === customer.sub_area_id);
        const subAreaName = subAreaObj ? subAreaObj.name : (customer.sub_area_id || '');
        const serverName = customer.Server ? customer.Server.name : 'Server Utama';

        // Format installation address: "Nama Server, Sub Area (Alamat)"
        const formattedAddress = [
            serverName,
            subAreaName,
            customer.address
        ].filter(Boolean).join(' - ');

        // 1. Sanitized profile (Strict: No Mikrotik secret info, display real_name as primary)
        const profile = {
            id: customer.id,
            name: customer.real_name || customer.name || 'Pelanggan',
            real_name: customer.real_name || customer.name || 'Pelanggan',
            account_name: customer.name || customer.real_name || 'Pelanggan',
            phone_number: customer.phone_number,
            address: formattedAddress || customer.address || 'Sesuai registrasi',
            raw_address: customer.address || '',
            server_name: serverName,
            sub_area_name: subAreaName,
            profile: currentProfile,
            status: currentStatus,
            activationDate: customer.activationDate || null,
            sub_area_id: customer.sub_area_id || null,
            mustChangePassword: customer.must_change_password !== false
        };

        // Resolve all related customer IDs linked to this customer (e.g. multi-account by name, username, real_name, or phone)
        const matchCriteria = [
            { id: targetId }
        ];
        if (customer.name) matchCriteria.push({ name: customer.name }, { mikrotik_name: customer.name });
        if (customer.mikrotik_name) matchCriteria.push({ name: customer.mikrotik_name }, { mikrotik_name: customer.mikrotik_name });
        if (customer.real_name) matchCriteria.push({ real_name: customer.real_name }, { name: customer.real_name });
        if (customer.phone_number && customer.phone_number.trim()) {
            const cleanPhone = customer.phone_number.replace(/\D/g, '');
            const phoneSuffix = cleanPhone.length >= 6 ? cleanPhone.slice(-6) : cleanPhone;
            matchCriteria.push({ phone_number: customer.phone_number });
            if (cleanPhone) matchCriteria.push({ phone_number: cleanPhone });
            if (phoneSuffix) matchCriteria.push({ phone_number: { [Op.like]: `%${phoneSuffix}` } });
        }

        const relatedCustomers = await Customer.findAll({
            attributes: ['id'],
            where: { [Op.or]: matchCriteria }
        }).catch(() => []);

        const relatedCustomerIds = Array.from(new Set([targetId, ...relatedCustomers.map(c => c.id)]));

        // 2. Invoices & Payments History across all customer accounts
        const invoices = await Invoice.findAll({
            where: { customer_id: { [Op.in]: relatedCustomerIds } },
            include: [{
                model: Payment,
                required: false
            }],
            order: [['due_date', 'DESC']],
            limit: 50
        });

        console.log(`[DASHBOARD INVOICES QUERY] TargetID: ${targetId}, Customer: ${customer.name}/${customer.real_name}, RelatedIDs: ${relatedCustomerIds.join(',')}, FoundInvoices: ${invoices.length}`);
        invoices.forEach(inv => console.log(`  - InvID: ${inv.id}, Period: ${inv.period}, Amount: ${inv.amount}, Status: ${inv.status}, CustID: ${inv.customer_id}`));

        // 3. Customer Vouchers with live login_url (Filter out expired/deleted vouchers)
        const rawVouchers = await CustomerVoucher.findAll({
            where: {
                status: { [Op.notIn]: ['expired', 'deleted'] },
                [Op.or]: [
                    { customer_id: targetId },
                    { notes: { [Op.like]: `%[CID:${targetId}]%` } },
                    ...(customer.phone_number ? [
                        { customer_phone: customer.phone_number },
                        { customer_phone: { [Op.like]: `%${customer.phone_number.replace(/\D/g, '').slice(-8)}%` } }
                    ] : []),
                    ...(customer.mikrotik_name ? [{ customer_username: customer.mikrotik_name }] : [])
                ]
            },
            order: [['createdAt', 'DESC']],
            limit: 50
        });

        // Determine base hotspot login URL for this customer's server
        let baseHotspotUrl = customer.Server?.hotspot_login_url;
        if (!baseHotspotUrl) {
            // Hotspot captive portal is accessed locally inside the router's hotspot network (e.g. login.giganusa.net or 172.16.0.1)
            baseHotspotUrl = 'http://login.giganusa.net/login';
        }
        if (!baseHotspotUrl.endsWith('/login') && !baseHotspotUrl.includes('?')) {
            baseHotspotUrl = baseHotspotUrl.replace(/\/+$/, '') + '/login';
        }

        // --- Helper function to run RouterOS commands on a specific server ---
        async function runMikrotikCommand(serverId, command) {
            const serverObj = await Server.findByPk(serverId);
            if (!serverObj) throw new Error('Server not found');
            const client = new RouterOSAPI({
                host: serverObj.ip,
                port: serverObj.port || 8728,
                user: serverObj.username,
                password: serverObj.password,
                timeout: 2
            });
            client.on('error', () => {});
            await client.connect();
            const resData = await client.write(command);
            await client.close();
            return resData;
        }

        // In-memory cache for live MikroTik hotspot queries (60-second TTL)
        if (!global.MIKROTIK_HOTSPOT_CACHE) {
            global.MIKROTIK_HOTSPOT_CACHE = {};
        }

        async function getMikrotikHotspotData(serverId) {
            const now = Date.now();
            const cached = global.MIKROTIK_HOTSPOT_CACHE[serverId];
            if (cached && (now - cached.timestamp < 60000)) {
                return cached;
            }

            try {
                // Wrap in 2.5s timeout Promise to prevent hanging if router IP is offline/unreachable
                const fetchPromise = Promise.all([
                    runMikrotikCommand(serverId, ['/ip/hotspot/user/print']),
                    runMikrotikCommand(serverId, ['/ip/hotspot/active/print']),
                    runMikrotikCommand(serverId, ['/ip/dhcp-server/lease/print']).catch(() => [])
                ]);

                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Mikrotik socket query timeout')), 2500)
                );

                const [usersData, activeData, leasesData] = await Promise.race([fetchPromise, timeoutPromise]);

                const result = {
                    timestamp: now,
                    users: Array.isArray(usersData) ? usersData : (cached?.users || []),
                    active: Array.isArray(activeData) ? activeData : (cached?.active || []),
                    leases: Array.isArray(leasesData) ? leasesData : (cached?.leases || [])
                };
                global.MIKROTIK_HOTSPOT_CACHE[serverId] = result;
                return result;
            } catch (err) {
                console.warn(`[Dashboard] Hotspot user data fetch warning for server ${serverId}:`, err.message);
                if (cached) return cached;
                return { timestamp: now, users: [], active: [], leases: [] };
            }
        }

        // --- Fetch live hotspot user data from MikroTik for usage stats ---
        const serverIdsToQuery = new Set();
        if (customer.server_id) serverIdsToQuery.add(customer.server_id);
        for (const v of rawVouchers) {
            if (v.server_id) serverIdsToQuery.add(v.server_id);
        }

        let hotspotUsers = [];
        let hotspotActiveUsers = [];
        let dhcpLeases = [];

        if (serverIdsToQuery.size > 0) {
            await Promise.all(Array.from(serverIdsToQuery).map(async (sId) => {
                const data = await getMikrotikHotspotData(sId);
                if (data.users) hotspotUsers.push(...data.users);
                if (data.active) hotspotActiveUsers.push(...data.active);
                if (data.leases) dhcpLeases.push(...data.leases);
            }));
        }

        // Index hotspot users and active sessions by username (name) for O(1) lookup
        const hotspotUserMap = {};
        for (const hu of hotspotUsers) {
            if (hu.name) hotspotUserMap[hu.name.toLowerCase().trim()] = hu;
        }
        const hotspotActiveMap = {};
        for (const ha of hotspotActiveUsers) {
            if (ha.user) hotspotActiveMap[ha.user.toLowerCase().trim()] = ha;
        }

        // Index DHCP leases by MAC address for device hostname lookup
        const dhcpByMac = {};
        for (const lease of dhcpLeases) {
            if (lease['mac-address']) {
                dhcpByMac[lease['mac-address'].toUpperCase().trim()] = lease;
            }
        }

        // Build live vouchers list by cross-referencing DB vouchers and live MikroTik hotspot users
        const liveVouchersMap = {};

        // 1. Process DB vouchers (always include all DB vouchers for this customer)
        for (const v of rawVouchers) {
            const vJson = v.toJSON();
            const voucherKey = (vJson.voucher_code || '').toLowerCase().trim();
            const mapKey = String(vJson.id || voucherKey || Math.random()).toLowerCase().trim();
            if (!mapKey) continue;

            const hsUser = (voucherKey ? hotspotUserMap[voucherKey] : null) || hotspotUsers.find(hu => 
                (voucherKey && hu.name && hu.name.toLowerCase().trim() === voucherKey) ||
                (voucherKey && hu.comment && hu.comment.toLowerCase().includes(voucherKey))
            );

            liveVouchersMap[mapKey] = { vJson, hsUser };
        }

        // 2. Auto-discover live MikroTik hotspot users tagged with [CID:targetId], phone, or username
        const lowerTargetId = String(targetId).toLowerCase().trim();
        const cleanPhone = (customer.phone_number || '').replace(/\D/g, '');
        const phoneSuffix = cleanPhone.length >= 8 ? cleanPhone.slice(-8) : cleanPhone;
        const custMikrotikName = (customer.mikrotik_name || '').toLowerCase().trim();

        for (const hu of hotspotUsers) {
            if (!hu.name) continue;
            const huComment = (hu.comment || '').toLowerCase();
            const huName = hu.name.toLowerCase().trim();

            const isCidMatch = huComment.includes(`[cid:${lowerTargetId}]`);
            const isPhoneMatch = phoneSuffix.length >= 6 && (huComment.includes(phoneSuffix) || huName.includes(phoneSuffix));
            const isUsernameMatch = custMikrotikName && custMikrotikName.length >= 3 && (huName === custMikrotikName || huComment.includes(custMikrotikName));

            if (isCidMatch || isPhoneMatch || isUsernameMatch) {
                const huKey = huName;
                // Check if this hotspot user code is already present in DB vouchers map
                const alreadyMapped = Object.values(liveVouchersMap).some(({ vJson }) => 
                    (vJson.voucher_code || '').toLowerCase().trim() === huKey
                );

                if (!alreadyMapped) {
                    let quotaGb = 1;
                    const qm = (hu.comment || '').match(/Kuota\s+(\d+)\s*GB/i);
                    if (qm) {
                        quotaGb = parseInt(qm[1], 10);
                    } else if (hu['limit-bytes-total']) {
                        const bytes = parseInt(hu['limit-bytes-total'], 10);
                        if (bytes > 0) quotaGb = Math.max(1, Math.round(bytes / 1073741824));
                    }

                    const synthV = {
                        id: hu['.id'] || huKey,
                        customer_id: targetId,
                        voucher_code: hu.name,
                        voucher_password: hu.password || hu.name,
                        profile: hu.profile || 'default',
                        quota_gb: quotaGb,
                        validity: hu['limit-uptime'] || '30d',
                        status: (hu.disabled === 'true' || hu.disabled === true || hu.disabled === 'yes') ? 'disabled' : 'active',
                        notes: hu.comment || null
                    };
                    liveVouchersMap[`synth_${hu['.id'] || huKey}`] = { vJson: synthV, hsUser: hu };
                }
            }
        }

        const vouchers = Object.values(liveVouchersMap).map(({ vJson, hsUser }) => {
            // Build dynamic 1-click activation link
            let autoLoginUrl = vJson.login_url;
            if (!autoLoginUrl && vJson.voucher_code) {
                const u = encodeURIComponent(vJson.voucher_code);
                const p = vJson.voucher_password ? encodeURIComponent(vJson.voucher_password) : '';
                autoLoginUrl = `${baseHotspotUrl}?username=${u}${p ? `&password=${p}` : ''}`;
            }

            const voucherKey = (vJson.voucher_code || '').toLowerCase().trim();
            const hsActive = hotspotActiveMap[voucherKey];

            // Usage data from hotspot user table + active session
            const usageData = {};
            
            // 1. Calculate bytes from user accounting (past finished sessions)
            const bIn = hsUser ? (parseInt(hsUser['bytes-in'] || '0', 10) || 0) : 0;
            const bOut = hsUser ? (parseInt(hsUser['bytes-out'] || '0', 10) || 0) : 0;

            // 2. Calculate bytes from live active session (if online right now)
            let activeBIn = 0;
            let activeBOut = 0;
            if (hsActive) {
                activeBIn = parseInt(hsActive['bytes-in'] || '0', 10) || 0;
                activeBOut = parseInt(hsActive['bytes-out'] || '0', 10) || 0;
            }

            // CUMULATIVE TRAFFIC = (Past sessions) + (Current active session)
            const totalBytesIn = bIn + activeBIn;
            const totalBytesOut = bOut + activeBOut;
            const totalUsed = totalBytesIn + totalBytesOut;

            // Determine quota & direction limits
            const limitTotal = hsUser ? (parseInt(hsUser['limit-bytes-total'] || '0', 10) || 0) : 0;
            const limitIn = hsUser ? (parseInt(hsUser['limit-bytes-in'] || '0', 10) || 0) : 0;
            const limitOut = hsUser ? (parseInt(hsUser['limit-bytes-out'] || '0', 10) || 0) : 0;
            const limitUptime = hsUser ? (hsUser['limit-uptime'] || '') : '';
            const fallbackLimit = (vJson.quota_gb ? (parseInt(vJson.quota_gb, 10) * 1073741824) : 0);
            const effectiveLimitTotal = limitTotal || fallbackLimit;

            if (hsUser || hsActive || effectiveLimitTotal > 0) {
                usageData.bytes_in = String(totalBytesIn);
                usageData.bytes_out = String(totalBytesOut);
                usageData.uptime = hsUser ? (hsUser['uptime'] || '0s') : '0s';
                usageData.limit_bytes_total = String(effectiveLimitTotal);
                usageData.limit_uptime = limitUptime;
                
                // Expiration / Exhaustion checks across all MikroTik Hotspot limit types:
                // 1. Total bytes limit reached (or within 10MB)
                const isTotalLimitReached = (effectiveLimitTotal > 0 && (totalUsed >= effectiveLimitTotal || (effectiveLimitTotal - totalUsed) <= 10485760));
                // 2. Limit Bytes In (Download limit) reached
                const isInLimitReached = (limitIn > 0 && totalBytesIn >= limitIn);
                // 3. Limit Bytes Out (Upload limit) reached
                const isOutLimitReached = (limitOut > 0 && totalBytesOut >= limitOut);
                // 4. Limit Uptime reached
                const uptimeSec = hsUser ? parseMikrotikDuration(hsUser['uptime']) : 0;
                const limitUptimeSec = parseMikrotikDuration(limitUptime);
                const isUptimeLimitReached = (limitUptimeSec > 0 && uptimeSec >= limitUptimeSec);

                const isLimitReached = isTotalLimitReached || isInLimitReached || isOutLimitReached || isUptimeLimitReached;

                // 5. User is disabled in MikroTik router
                const isDisabledInMikrotik = hsUser ? (hsUser['disabled'] === 'true' || hsUser['disabled'] === true || hsUser['disabled'] === 'yes') : false;
                // 6. User comment contains [EXHAUSTED] or [EXPIRED]
                const isCommentExhausted = hsUser?.comment && (hsUser.comment.toLowerCase().includes('exhausted') || hsUser.comment.toLowerCase().includes('expired'));

                usageData.is_quota_exhausted = isLimitReached || isCommentExhausted;
                usageData.disabled = isDisabledInMikrotik || isLimitReached || isCommentExhausted;
            }

            // Active session data (enriched with DHCP hostname)
            if (hsActive) {
                usageData.is_online = true;
                usageData.session_uptime = hsActive['uptime'] || '';
                usageData.session_bytes_in = hsActive['bytes-in'] || '0';
                usageData.session_bytes_out = hsActive['bytes-out'] || '0';
                usageData.ip_address = hsActive['address'] || '';
                usageData.mac_address = hsActive['mac-address'] || '';
                usageData.login_by = hsActive['login-by'] || '';
                usageData.hotspot_server = hsActive['server'] || '';
                usageData.idle_time = hsActive['idle-time'] || '';

                // Session total data
                const sIn = parseInt(hsActive['bytes-in'] || '0', 10) || 0;
                const sOut = parseInt(hsActive['bytes-out'] || '0', 10) || 0;
                usageData.session_total_bytes = String(sIn + sOut);

                // Lookup device hostname from DHCP lease by MAC address
                const activeMac = (hsActive['mac-address'] || '').toUpperCase().trim();
                const dhcpLease = activeMac ? dhcpByMac[activeMac] : null;
                if (dhcpLease) {
                    usageData.device_hostname = dhcpLease['host-name'] || '';
                    usageData.dhcp_server = dhcpLease['server'] || '';
                    usageData.dhcp_status = dhcpLease['status'] || '';
                    usageData.dhcp_last_seen = dhcpLease['last-seen'] || '';
                    usageData.dhcp_active_address = dhcpLease['active-address'] || '';
                } else {
                    usageData.device_hostname = '';
                }
            } else {
                usageData.is_online = false;
            }

            let finalStatus = (vJson.status || 'active').toLowerCase();
            if (usageData.disabled) {
                finalStatus = 'disabled';
            }

            return {
                ...vJson,
                status: finalStatus,
                login_url: autoLoginUrl,
                server_hotspot_url: baseHotspotUrl,
                usage: usageData
            };
        });

        res.json({
            success: true,
            customer: profile,
            invoices,
            vouchers
        });
    } catch (error) {
        console.error('[Customer Portal Dashboard Error]', error);
        res.status(500).json({ error: 'Gagal mengambil data dashboard: ' + error.message });
    }
});

// Reset Hotspot User Counters (bytes-in, bytes-out, uptime -> 0 and enable user)
app.post('/api/mikrotik/hotspot/users/reset-counters', async (req, res) => {
    try {
        const { serverId, id, username } = req.body;
        if (!serverId || (!id && !username)) {
            return res.status(400).json({ error: 'serverId and id or username required' });
        }

        const server = await Server.findByPk(serverId);
        if (!server) return res.status(404).json({ error: 'Server not found' });

        const client = new RouterOSAPI({
            host: server.ip,
            port: server.port || 8728,
            user: server.username,
            password: server.password,
            timeout: 10
        });
        client.on('error', () => {});
        await client.connect();

        let targetId = id;
        let targetName = username;

        if (!targetId && targetName) {
            const users = await client.write(['/ip/hotspot/user/print', `?name=${targetName}`]);
            if (Array.isArray(users) && users.length > 0) {
                targetId = users[0]['.id'];
            }
        }

        if (targetId) {
            await client.write(['/ip/hotspot/user/reset-counters', `=.id=${targetId}`]);
            // Re-enable user in MikroTik
            await client.write(['/ip/hotspot/user/set', `=.id=${targetId}`, '=disabled=no']);
        } else if (targetName) {
            await client.write(['/ip/hotspot/user/reset-counters', `=numbers=${targetName}`]);
        }

        await client.close();

        // Also update SQL CustomerVoucher status if linked
        if (targetName) {
            await CustomerVoucher.update(
                { status: 'active' },
                { where: { voucher_code: targetName } }
            );
        }

        logActivity(req, 'RESET_HOTSPOT_COUNTERS', `Reset counters & re-enabled user ${targetName || targetId} on ${server.name}`);
        res.json({ success: true, message: `Counter kuota & uptime user ${targetName || ''} berhasil di-reset ke 0!` });
    } catch (error) {
        console.error('[Reset Hotspot Counters Error]', error);
        res.status(500).json({ error: 'Gagal reset counter: ' + error.message });
    }
});

// Check Live WiFi Status on-demand (PPP Active check, strictly on-demand)
app.get('/api/customer-portal/wifi-status', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const { customerId } = req.query;

        let targetId = customerId;
        if (!targetId && authHeader) {
            const token = authHeader.split(' ')[1];
            const sessions = getSessionsDB();
            const session = sessions[token];
            if (session) targetId = session.customerId;
        }

        if (!targetId) {
            return res.status(401).json({ error: 'Unauthorized: customerId or token required' });
        }

        const customer = await Customer.findByPk(targetId, {
            include: [{ model: Server }]
        });
        if (!customer) {
            return res.status(404).json({ error: 'Pelanggan tidak ditemukan' });
        }

        const server = customer.Server;
        const mikrotikUsername = customer.mikrotik_name;

        if (!server || !mikrotikUsername) {
            return res.json({
                success: true,
                connected: false,
                status: 'offline',
                message: 'Tidak Aktif'
            });
        }

        let isConnected = false;
        let uptime = null;
        let callerId = null;
        let bytesIn = 0;
        let bytesOut = 0;

        const formatBytes = (bytes) => {
            if (!bytes || isNaN(bytes) || bytes <= 0) return '0 B';
            const units = ['B', 'KB', 'MB', 'GB', 'TB'];
            let val = Number(bytes);
            let idx = 0;
            while (val >= 1024 && idx < units.length - 1) {
                val /= 1024;
                idx++;
            }
            return `${val.toFixed(val < 10 && idx > 0 ? 2 : 1)} ${units[idx]}`;
        };

        const formatUptime = (rawUptime) => {
            if (!rawUptime) return '-';
            // Translate MikroTik notation: e.g. 1w2d3h4m5s to readable Indonesian text
            let str = String(rawUptime);
            str = str.replace(/w/g, 'mgg ').replace(/d/g, 'h ').replace(/h/g, 'j ').replace(/m/g, 'm ').replace(/s/g, 'd');
            return str.trim();
        };

        // Try querying RouterOS directly with a short timeout
        let client = null;
        try {
            client = new RouterOSAPI({
                host: server.ip,
                port: server.port || 8728,
                user: server.username,
                password: server.password,
                keepalive: false,
                timeout: 2
            });

            client.on('error', () => {});

            const connectPromise = (async () => {
                await client.connect();
                return await client.write(['/ppp/active/print', `?name=${mikrotikUsername}`]);
            })();

            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('PPP status query timeout')), 2000)
            );

            const actives = await Promise.race([connectPromise, timeoutPromise]);

            if (Array.isArray(actives) && actives.length > 0) {
                isConnected = true;
                const rec = actives[0];
                uptime = rec.uptime || null;
                callerId = rec['caller-id'] || null;
                bytesIn = Number(rec['bytes-in'] || rec['limit-bytes-in'] || 0);
                bytesOut = Number(rec['bytes-out'] || rec['limit-bytes-out'] || 0);

                // Also try to query specific interface traffic if available (e.g. <pppoe-username>)
                try {
                    const ifaces = await client.write(['/interface/print', `?name=<pppoe-${mikrotikUsername}>`]);
                    if (Array.isArray(ifaces) && ifaces.length > 0) {
                        const iface = ifaces[0];
                        if (iface['rx-byte']) bytesIn = Number(iface['rx-byte']);
                        if (iface['tx-byte']) bytesOut = Number(iface['tx-byte']);
                    }
                } catch (_) {}
            }
        } catch (routerErr) {
            console.log(`[WiFi Status] Router direct query error:`, routerErr.message);
        } finally {
            if (client) {
                try { await client.close(); } catch (_) {}
            }
        }

        // Fallback: check active_ppp cache if router direct query did not find connection
        if (!isConnected) {
            const cachePath = getCachePath(server.id, 'active_ppp');
            if (fs.existsSync(cachePath)) {
                try {
                    const cacheRaw = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
                    const activeList = Array.isArray(cacheRaw) ? cacheRaw : (cacheRaw.data || []);
                    const found = activeList.find(a => 
                        String(a.name).toLowerCase().trim() === String(mikrotikUsername).toLowerCase().trim()
                    );
                    if (found) {
                        isConnected = true;
                        uptime = found.uptime || null;
                        bytesIn = Number(found['bytes-in'] || 0);
                        bytesOut = Number(found['bytes-out'] || 0);
                    }
                } catch (eCache) { }
            }
        }

        const totalBytes = (bytesIn || 0) + (bytesOut || 0);
        const usageFormatted = totalBytes > 0 ? formatBytes(totalBytes) : (isConnected ? 'Aktif' : '0 B');
        const uptimeFormatted = uptime ? formatUptime(uptime) : (isConnected ? 'Aktif' : '-');

        res.json({
            success: true,
            connected: isConnected,
            status: isConnected ? 'online' : 'offline',
            label: isConnected ? 'Terhubung' : 'Tidak Aktif',
            uptime: uptimeFormatted,
            rawUptime: uptime || null,
            totalBytes,
            usage: usageFormatted,
            bytesIn: formatBytes(bytesIn),
            bytesOut: formatBytes(bytesOut),
            checkedAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });
    } catch (e) {
        console.error('[WiFi Status Error]', e);
        res.status(500).json({ error: 'Gagal mengecek status WiFi: ' + e.message });
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

// Serve GigaNusa Customer Portal App
const CUSTOMER_APP_PREVIEW = path.join(__dirname, '../customer_app/preview.html');
app.get('/customer', (req, res) => {
    if (fs.existsSync(CUSTOMER_APP_PREVIEW)) {
        return res.sendFile(CUSTOMER_APP_PREVIEW);
    }
    res.status(404).send('Customer App preview not found');
});

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
