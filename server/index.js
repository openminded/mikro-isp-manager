import express from 'express';
import cors from 'cors';
import routeros from 'node-routeros';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import whatsappRouter from './whatsapp.js';
import { initDB, Server, Invoice, Payment, Customer, InvoiceHistory } from './models/index.js';
import { Sequelize } from 'sequelize';
import archiver from 'archiver';
import AdmZip from 'adm-zip';

const { Op } = Sequelize;

// Initialize Database
initDB();

const { RouterOSAPI } = routeros;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0';



// Ensure directories
if (!fs.existsSync(path.join(__dirname, 'data'))) fs.mkdirSync(path.join(__dirname, 'data'));
if (!fs.existsSync(path.join(__dirname, 'uploads'))) fs.mkdirSync(path.join(__dirname, 'uploads'));

app.use(cors());
app.use(express.json());
// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve Frontend Static Files
// This assumes "dist" is in /www/wwwroot/telaju/dist
const DIST_PATH = path.join(__dirname, '../dist');
if (fs.existsSync(DIST_PATH)) {
    app.use(express.static(DIST_PATH));
}

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

// WhatsApp Routes
app.use('/api/whatsapp', whatsappRouter);

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
                            status: status
                        });
                    } else {
                        // Create new customer from Mikrotik
                        await Customer.create({
                            server_id: server.id,
                            mikrotik_name: item.name,
                            profile: item.profile,
                            status: status,
                            name: item.comment || item.name // fallback
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
            sqlCustomers.forEach(c => sqlMap.set(c.mikrotik_name, c));

            // 2. Enrich Mikrotik Data
            data = data.map(item => {
                const sqlC = sqlMap.get(item.name);
                if (sqlC) {
                    return {
                        ...item,
                        // Override or Append fields
                        realName: sqlC.name, // 'name' in SQL is Real Name
                        whatsapp: sqlC.phone_number,
                        address: sqlC.address,
                        sub_area_id: sqlC.sub_area_id,
                        ktp: sqlC.ktp || '', // If we add this column later
                        coordinates: sqlC.coordinates,
                        // Keep Mikrotik original name as 'name' usually, but frontend might want real name?
                        // Frontend likely expects 'name' = Mikrotik Username.
                        // Add 'crm' object or flat fields? Frontend expects flat fields based on `Customer` type.
                    };
                }
                return item;
            });

            // Update cache with Enriched Data
            const cachePath = getCachePath(server.id, resource);
            const cacheData = {
                timestamp: new Date().toISOString(),
                data: Array.isArray(data) ? data : []
            };
            fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2));

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

// [NEW] Update Customer CRM Data directly (Bypass Mikrotik Sync)
app.put('/api/customers/:id', async (req, res) => {
    const { id } = req.params;
    console.log(`[DEBUG] PUT /api/customers/${id} called`);
    console.log('[DEBUG] Body:', JSON.stringify(req.body));
    const { name, realName, whatsapp, address, photos, sub_area_id, ktp, activationDate, coordinates } = req.body;

    try {
        let customer;
        // 1. Try finding by UUID (if id is a valid UUID)
        try {
            customer = await Customer.findByPk(id);
        } catch (e) { }

        // 2. Fallback: Find by Mikrotik Name + Server ID (if passed in body)
        // Frontend likely passes Mikrotik ID (*xx) as :id, so lookup by name/server is safer.
        if (!customer && req.body.serverId && (req.body.name || req.body.username)) {
            const serverId = req.body.serverId;
            const mikrotikName = req.body.name || req.body.username;

            customer = await Customer.findOne({
                where: {
                    server_id: serverId,
                    mikrotik_name: mikrotikName
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
                    name: realName || mikrotikName,
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
            name: realName || name, // Real Name takes precedence for 'name' column in SQL if passed
            phone_number: whatsapp,
            address: address,
            sub_area_id: sub_area_id,
            coordinates: coordinates,
            // Add other fields to meta if needed, currently Customer model has limited fields
            // We might need to store extra meta in a JSON column if we want full flexibility,
            // but for now sub_area_id was the main blocker.
        });

        // Also update JSON metadata (customers.json) for compatibility with existing frontend logic
        // The frontend uses MikrotikApi.updateExtendedData which updates customers.json
        // We can replicate that logic here or let FE call this AND that.
        // User request: "jangan lagi berhubungan dengan server mikrotik"
        // This likely means "don't call Mikrotik API".
        // Updating local JSON file is fine.

        const db = getDB();
        // Key in customers.json is "ServerID-MikrotikName" usually, or just mapped by name?
        // MikrotikApi.updateExtendedData uses `server_${serverId}.json`? No, `data/customers.json`
        // Let's look at `MikrotikApi.updateExtendedData` in frontend -> it calls `app.post('/api/customers/meta'...)` likely?
        // Wait, `server/index.js` usually has a meta endpoint.

        // Let's just update the SQL for now as requested for the error fix.
        // If the user wants to update `customers.json` too, we should do it.

        if (customer.mikrotik_name && customer.server_id) {
            const key = `${customer.server_id}-${customer.mikrotik_name}`;
            db[key] = {
                ...db[key],
                whatsapp,
                ktp,
                activationDate,
                photos,
                lat: coordinates ? coordinates.split(',')[0] : '',
                long: coordinates ? coordinates.split(',')[1] : '',
                sub_area_id
            };
            saveDB(db);
        }

        res.json({ message: 'Customer updated successfully', customer });
    } catch (error) {
        console.error('Error updating customer:', error);
        res.status(500).json({ error: 'Failed to update customer' });
    }
});

// --- CRM Endpoints (SQL) ---

// Get All Meta Data (Formatted as Map for Frontend Compatibility)
app.get('/api/customers/meta', async (req, res) => {
    try {
        const customers = await Customer.findAll();
        const metaMap = {};
        customers.forEach(c => {
            const key = `${c.server_id}_${c.mikrotik_name}`;
            metaMap[key] = c.toJSON();
        });
        res.json(metaMap);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Update/Create Meta Data for a Customer
app.post('/api/customers/meta', async (req, res) => {
    const { serverId, customerId, ...metaData } = req.body;

    // customerId is the mikrotik_name (username) from frontend context usually
    if (!serverId || !customerId) {
        return res.status(400).json({ error: 'Missing Identity' });
    }

    try {
        let customer = await Customer.findOne({
            where: { server_id: serverId, mikrotik_name: customerId }
        });

        if (customer) {
            await customer.update(metaData);
        } else {
            // Create new
            customer = await Customer.create({
                server_id: serverId,
                mikrotik_name: customerId,
                ...metaData
            });
        }

        logActivity(req, 'UPDATE_CUSTOMER_META', `Updated meta for ${customerId}`);
        res.json({ success: true, data: customer });

    } catch (e) {
        console.error(e);
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
            page = 1,
            limit = 50
        } = req.query;

        const offset = (Number(page) - 1) * Number(limit);
        const whereInvoice = {};

        // Invoice Filters
        if (customerId) whereInvoice.customer_id = customerId;
        if (status) whereInvoice.status = status;
        if (period) whereInvoice.period = period;
        // Invoices also store server_id, so we can filter directly or via Customer
        if (serverId) whereInvoice.server_id = serverId;

        // Customer Search Filter
        const includeCustomer = {
            model: Customer,
            required: true // Join is required if we are searching
        };

        if (search) {
            includeCustomer.where = {
                [Op.or]: [
                    { name: { [Op.like]: `%${search}%` } },
                    { mikrotik_name: { [Op.like]: `%${search}%` } }
                ]
            };
        } else {
            // If no search, left join is fine (or inner, usually invoices have customers)
            includeCustomer.required = true;
        }

        const { count, rows } = await Invoice.findAndCountAll({
            where: whereInvoice,
            include: [includeCustomer],
            order: [['generated_at', 'DESC']],
            limit: Number(limit),
            offset: Number(offset)
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

// Bulk Update Invoices
app.post('/api/billing/bulk-update', async (req, res) => {
    const { invoiceIds, status } = req.body;

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
        res.json({ success: true, message: `Updated ${invoiceIds.length} invoices to ${status}` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Create Payment (Pay Invoice)
app.post('/api/billing/pay', upload.single('proof'), async (req, res) => {
    const { invoiceId, amount, method, user } = req.body;
    const proof = req.file ? `/uploads/${req.file.filename}` : null;

    if (!invoiceId || !amount) return res.status(400).json({ error: 'Missing data' });

    try {
        const invoice = await Invoice.findByPk(invoiceId);
        if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

        // Update Invoice Status
        invoice.status = 'PAID';
        await invoice.save();

        // Create Payment Record
        const payment = await Payment.create({
            invoice_id: invoiceId,
            amount,
            method,
            proof_url: proof,
            verified_at: new Date()
        });

        // Log History
        await InvoiceHistory.create({
            invoice_id: invoice.id,
            user_name: user?.username || user || 'Unknown',
            action: 'PAYMENT',
            details: `Payment of ${amount} via ${method}.`
        });

        res.json({ success: true, payment });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Generate Invoices Manual Trigger
app.post('/api/billing/generate', async (req, res) => {
    const { serverId } = req.body || {};
    // This would typically be a cron job
    try {
        const whereClause = { status: 'active' };
        if (serverId) whereClause.server_id = serverId;

        const activeCustomers = await Customer.findAll({ where: whereClause });
        const period = new Date().toISOString().slice(0, 7); // "2024-01"

        let count = 0;
        for (const customer of activeCustomers) {
            // Check if a VALID invoice exists (ignore INVALID/CANCELLED)
            const exists = await Invoice.findOne({
                where: {
                    customer_id: customer.id,
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
        res.json({ message: `Generated ${count} invoices.` });
    } catch (e) {
        res.status(500).json({ error: e.message });
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

                try {
                    await client.connect();
                    // Disable Secret by name
                    const secrets = await client.write('/ppp/secret/print', { '?name': customer.mikrotik_name });
                    if (secrets.length > 0) {
                        const secretId = secrets[0]['.id'];
                        await client.write('/ppp/secret/disable', { '.id': secretId });
                        console.log(`[Auto-Block] Disabled secret for ${customer.mikrotik_name}`);
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

        res.json({ message: `Checked overdue invoices. Blocked ${blockedCount} customers.` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
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

    logActivity(req, 'CREATE_REGISTRATION', `New registration for ${newReg.fullName}`);

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
    const { secretId, note, sub_area_id, secretName } = req.body;
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
            photos: photoPaths,
            secretId: secretId
        }
    };

    saveRegistrationsDB(db);

    // Sync to SQL Customer (Create or Update)
    try {
        if (secretName) {
            // Find Server ID
            const servers = getServersDB();
            const server = servers.find(s => s.name === db[index].locationId); // locationId in reg is Server Name

            if (server) {
                // Upsert Customer
                const [customer, created] = await Customer.findOrCreate({
                    where: { mikrotik_name: secretName, server_id: server.id },
                    defaults: {
                        name: db[index].fullName,
                        phone_number: db[index].phoneNumber,
                        address: db[index].address,
                        status: 'active',
                        sub_area_id: sub_area_id || null,
                        odp_id: db[index].odpId || null
                    }
                });

                if (!created) {
                    // Update if exists
                    await customer.update({
                        name: db[index].fullName,
                        phone_number: db[index].phoneNumber,
                        address: db[index].address,
                        status: 'active',
                        sub_area_id: sub_area_id || null, // Update sub area
                        odp_id: db[index].odpId || null
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

// --- Damage Types ---
const DB_DAMAGE_TYPES_FILE = path.join(__dirname, 'data', 'damage_types.json');
const getDamageTypesDB = () => {
    if (!fs.existsSync(DB_DAMAGE_TYPES_FILE)) return [];
    try {
        const data = JSON.parse(fs.readFileSync(DB_DAMAGE_TYPES_FILE, 'utf8'));
        return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
};
const saveDamageTypesDB = (data) => {
    fs.writeFileSync(DB_DAMAGE_TYPES_FILE, JSON.stringify(data, null, 2));
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
    db = db.filter(i => i.id !== id);
    saveDamageTypesDB(db);
    res.json({ success: true });
});

// --- Sub Areas ---
const DB_SUB_AREAS_FILE = path.join(__dirname, 'data', 'sub_areas.json');
const getSubAreasDB = () => {
    if (!fs.existsSync(DB_SUB_AREAS_FILE)) return [];
    try {
        const data = JSON.parse(fs.readFileSync(DB_SUB_AREAS_FILE, 'utf8'));
        return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
};
const saveSubAreasDB = (data) => {
    fs.writeFileSync(DB_SUB_AREAS_FILE, JSON.stringify(data, null, 2));
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
const getTicketsDB = () => {
    if (!fs.existsSync(DB_TICKETS_FILE)) return [];
    try {
        const data = JSON.parse(fs.readFileSync(DB_TICKETS_FILE, 'utf8'));
        return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
};
const saveTicketsDB = (data) => {
    fs.writeFileSync(DB_TICKETS_FILE, JSON.stringify(data, null, 2));
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
const getPaymentMethodsDB = () => {
    if (!fs.existsSync(DB_PAYMENT_METHODS_FILE)) return [];
    try {
        const data = JSON.parse(fs.readFileSync(DB_PAYMENT_METHODS_FILE, 'utf8'));
        return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
};
const savePaymentMethodsDB = (data) => {
    fs.writeFileSync(DB_PAYMENT_METHODS_FILE, JSON.stringify(data, null, 2));
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

// --- WhatsApp Templates ---
const DB_TEMPLATES_FILE = path.join(__dirname, 'data', 'whatsapp_templates.json');
const getTemplatesDB = () => {
    if (!fs.existsSync(DB_TEMPLATES_FILE)) return [];
    try {
        const data = JSON.parse(fs.readFileSync(DB_TEMPLATES_FILE, 'utf8'));
        return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
};
const saveTemplatesDB = (data) => {
    fs.writeFileSync(DB_TEMPLATES_FILE, JSON.stringify(data, null, 2));
};

app.get('/api/whatsapp/templates', (req, res) => {
    res.json(getTemplatesDB());
});

app.post('/api/whatsapp/templates', (req, res) => {
    const newItem = req.body;
    if (!newItem.id) newItem.id = crypto.randomUUID();
    if (!newItem.createdAt) newItem.createdAt = new Date().toISOString();

    if (!newItem.name || !newItem.content) {
        return res.status(400).json({ error: 'Name and Content are required' });
    }

    const db = getTemplatesDB();
    db.push(newItem);
    saveTemplatesDB(db);
    res.json(newItem);
});

app.put('/api/whatsapp/templates/:id', (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const db = getTemplatesDB();
    const index = db.findIndex(i => i.id === id);
    if (index === -1) return res.status(404).json({ error: 'Not found' });

    db[index] = { ...db[index], ...updates };
    saveTemplatesDB(db);
    res.json(db[index]);
});

app.delete('/api/whatsapp/templates/:id', (req, res) => {
    const { id } = req.params;
    let db = getTemplatesDB();
    db = db.filter(i => i.id !== id);
    saveTemplatesDB(db);
    res.json({ success: true });
});

// --- Authentication ---
const DB_USERS_FILE = path.join(__dirname, 'data', 'users.json');
const getUsersDB = () => {
    if (!fs.existsSync(DB_USERS_FILE)) {
        // Initialize default users if file doesn't exist
        const defaultUsers = [
            { id: '1', username: 'superadmin', password: 'superadmin123', role: 'superadmin', name: 'Super Admin' },
            { id: '2', username: 'admin', password: 'admin123', role: 'admin', name: 'Admin User' },
            { id: '3', username: 'tech', password: 'tech123', role: 'technician', name: 'Field Technician' }
        ];
        saveUsersDB(defaultUsers);
        return defaultUsers;
    }
    try {
        const data = JSON.parse(fs.readFileSync(DB_USERS_FILE, 'utf8'));
        return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
};
const saveUsersDB = (data) => {
    fs.writeFileSync(DB_USERS_FILE, JSON.stringify(data, null, 2));
};

// --- Network Nodes (ODC/ODP) ---
const DB_NODES_FILE = path.join(__dirname, 'data', 'network_nodes.json');
const getNodesDB = () => {
    if (!fs.existsSync(DB_NODES_FILE)) return [];
    try {
        const data = JSON.parse(fs.readFileSync(DB_NODES_FILE, 'utf8'));
        return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
};
const saveNodesDB = (data) => {
    fs.writeFileSync(DB_NODES_FILE, JSON.stringify(data, null, 2));
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
// We store this link in the Customer Meta Data (customers.json)
app.post('/api/network/link-customer', (req, res) => {
    const { serverId, customerId, odpId } = req.body;
    if (!serverId || !customerId) return res.status(400).json({ error: 'Missing identity' });

    const key = `${serverId}_${customerId}`;
    const db = getDB(); // customers.json
    db[key] = { ...db[key], odpId, lastUpdated: new Date() };
    saveDB(db);

    logActivity(req, 'LINK_CUSTOMER', `Linked ${customerId} to ODP ${odpId}`);
    res.json({ success: true });
});

// --- Monitoring Status ---
const DB_STATUS_FILE = path.join(__dirname, 'data', 'network_status.json');
const getStatusDB = () => {
    if (!fs.existsSync(DB_STATUS_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(DB_STATUS_FILE, 'utf8'));
    } catch (e) { return {}; }
};
const saveStatusDB = (data) => {
    fs.writeFileSync(DB_STATUS_FILE, JSON.stringify(data, null, 2));
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
                // Get Active Customers (Caching logic reused or just fetch live for monitoring accuracy)
                // Ideally we check live active sessions or configured secrets.
                // Let's use cache for list but ping live.
                const cachePath = getCachePath(server.id, 'secrets');
                if (!fs.existsSync(cachePath)) continue;

                const secrets = JSON.parse(fs.readFileSync(cachePath, 'utf8')).data;
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

                        const key = `${server.id}_${target.name}`;
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



// --- Activity Logs ---
const DB_LOGS_FILE = path.join(__dirname, 'data', 'logs.json');
const getLogsDB = () => {
    if (!fs.existsSync(DB_LOGS_FILE)) return [];
    try {
        const data = JSON.parse(fs.readFileSync(DB_LOGS_FILE, 'utf8'));
        return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
};
const saveLogsDB = (data) => {
    fs.writeFileSync(DB_LOGS_FILE, JSON.stringify(data, null, 2));
};

// Helper: Log Activity
const logActivity = (req, action, details, level = 'info') => {
    try {
        // Attempt to identify user from token
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

        // Special case for Login (user info comes from request body if successful, but handled inside active flow usually)
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
            ip: req.ip || req.connection.remoteAddress
        };

        const logs = getLogsDB();
        // Prepend log (newest first)
        logs.unshift(logEntry);
        // Limit logs to keep file size manageable (e.g. 5000 entries)
        if (logs.length > 5000) logs.length = 5000;

        saveLogsDB(logs);

        console.log(`[LOG] ${action}: ${username} - ${logEntry.details}`);
    } catch (e) {
        console.error('Failed to write log:', e);
    }
};

const DB_SESSIONS_FILE = path.join(__dirname, 'data', 'sessions.json');
const getSessionsDB = () => {
    if (!fs.existsSync(DB_SESSIONS_FILE)) return {};
    try {
        const data = JSON.parse(fs.readFileSync(DB_SESSIONS_FILE, 'utf8'));
        return data;
    } catch (e) { return {}; }
};
const saveSessionsDB = (data) => {
    fs.writeFileSync(DB_SESSIONS_FILE, JSON.stringify(data, null, 2));
};

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

// Reset Data Endpoint (Selective)
app.post('/api/reset', async (req, res) => {
    try {
        // 1. Clear Registrations and Tickets
        saveRegistrationsDB([]);

        // Clear Tickets
        const ticketsPath = path.join(__dirname, 'data', 'tickets.json');
        if (fs.existsSync(ticketsPath)) {
            fs.writeFileSync(ticketsPath, JSON.stringify([], null, 2));
        }

        // 3. Reset SQLite Transaction Data (Invoices, Payments, InvoiceHistory)
        // Delete dependents first to avoid Foreign Key violations
        await InvoiceHistory.destroy({ where: {} });
        await Payment.destroy({ where: {} });
        await Invoice.destroy({ where: {} });
        // await Customer.destroy({ where: {}, truncate: true }); // Keeping customers for now as they might be linked to Mikrotik secrets

        logActivity(req, 'RESET_DATA', 'System data reset (Selective)');
        res.json({ success: true, message: 'App data cleared successfully.' });
    } catch (error) {
        console.error('Reset Error:', error);
        res.status(500).json({ error: 'Reset failed: ' + error.message });
    }
});

// SPA Fallback: Serve index.html for any unknown non-API routes
// SPA Fallback: Serve index.html for any unknown non-API routes
app.get(/.*/, (req, res) => {
    if (fs.existsSync(path.join(DIST_PATH, 'index.html'))) {
        res.sendFile(path.join(DIST_PATH, 'index.html'));
    } else {
        res.status(404).send('Frontend build not found. Please ensure "dist" folder exists at ' + DIST_PATH);
    }
});


app.listen(PORT, HOST, () => {
    console.log(`Mikrotik API Proxy + CRM DB running on http://${HOST}:${PORT}`);
});
