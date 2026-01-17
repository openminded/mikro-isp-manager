
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDB, Server, Customer } from '../models/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data');

const readJSON = (filename) => {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) return [];
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        // Handle array vs object (customers.json is object key->val, servers.json is array)
        return data;
    } catch (e) {
        console.error(`Failed to read ${filename}:`, e);
        return null;
    }
};

const migrate = async () => {
    console.log('[Migration] Starting JSON to SQLite migration...');
    await initDB();

    // 1. Migrate Servers
    const servers = readJSON('servers.json');
    const serverMap = new Map(); // Old ID -> Valid UUID or Model Instance

    if (Array.isArray(servers)) {
        for (const s of servers) {
            console.log(`Processing Server: ${s.name}`);
            // Check if exists
            let server = await Server.findOne({ where: { ip: s.ip } });
            if (!server) {
                server = await Server.create({
                    id: s.id, // Try to keep ID if it's UUID, else let it auto-gen if needed. Current IDs are UUIDs.
                    name: s.name,
                    ip: s.ip,
                    port: s.port,
                    username: s.username,
                    password: s.password,
                    default_billing_day: 1 // Default
                });
            }
            serverMap.set(s.id, server.id);
        }
        console.log(`[Migration] Migrated ${servers.length} servers.`);
    }

    // 2. Migrate Customers
    const customersMeta = readJSON('customers.json'); // This is an object: "serverId_username": { ...data }
    // We need to fetch secrets from Mikrotik mainly, but here we only have metadata.
    // The previous app relied on live sync.
    // However, we want to populate our 'Customers' table. `customers.json` contains linked data like WhatsApp, RealName, etc.

    // Strategy: We can't fully populate Customers without syncing from Mikrotik routers first.
    // BUT, we can populate what we know from metadata if we can parse the key `serverId_username`.

    // Since we are moving to a DB-first approach, the "Customer" table should be the source of truth, 
    // and we sync Mikrotik *against* it. 
    // For now, let's just log that we need to run a "Sync" from the UI to populate customers fully.

    // Attempt to migrate metadata if we can match server IDs.
    if (customersMeta) {
        let count = 0;
        for (const [key, data] of Object.entries(customersMeta)) {
            // Key format: 'serverId_username'
            // We need to split by FIRST underscore (username might have underscores?)
            // Actually, Server ID is UUID, so it has no underscores? UUID has hyphens.
            // Let's safe split.
            const parts = key.split('_');
            const serverId = parts[0];
            const username = parts.slice(1).join('_');

            if (serverMap.has(serverId)) {
                // We create a customer record placeholder. 
                // When we Sync from Mikrotik later, it should match this username and server_id.
                const existing = await Customer.findOne({ where: { server_id: serverId, mikrotik_name: username } });

                if (!existing) {
                    await Customer.create({
                        mikrotik_name: username,
                        server_id: serverId,
                        name: data.realName || data.name, // 'name' in meta might be real name
                        phone_number: data.whatsapp,
                        address: data.address, // if any
                        // ... other meta
                    });
                    count++;
                }
            }
        }
        console.log(`[Migration] Pre-populated ${count} customers from metadata.`);
    }

    console.log('[Migration] Migration complete.');
};

migrate().then(() => process.exit()).catch(err => {
    console.error(err);
    process.exit(1);
});
