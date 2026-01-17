
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDB, Customer, Server } from './models/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const run = async () => {
    await initDB();

    // 1. Find a secrets cache file
    const dataDir = path.join(__dirname, 'data');
    const files = fs.readdirSync(dataDir);
    const secretFile = files.find(f => f.startsWith('cache_') && f.endsWith('_secrets.json'));

    if (!secretFile) {
        console.error('No secrets cache file found!');
        return;
    }

    console.log(`Reading cache file: ${secretFile}`);
    const content = JSON.parse(fs.readFileSync(path.join(dataDir, secretFile), 'utf8'));
    const data = content.data;

    if (!Array.isArray(data)) {
        console.error('Cache data is not an array');
        return;
    }

    console.log(`Found ${data.length} secrets in cache.`);

    // Extract serverId from filename: cache_{serverId}_secrets.json
    const serverId = secretFile.split('_')[1];
    console.log(`Target Server ID: ${serverId}`);

    // Ensure server exists in DB (or create dummy) because of Foreign Key
    let server = await Server.findByPk(serverId);
    if (!server) {
        console.log('Server not found in DB, creating dummy...');
        try {
            server = await Server.create({
                id: serverId,
                name: 'Debug Server',
                ip: '192.168.1.1',
                username: 'admin',
                password: 'password'
            });
        } catch (e) {
            console.error('Failed to create dummy server:', e);
            // Verify if it failed because it already exists?
        }
    }

    console.log('Starting Sync Simulation...');
    let updated = 0;
    let created = 0;
    let errors = 0;

    for (const item of data) {
        if (!item.name) continue;

        try {
            let status = 'active';
            if (item.disabled === 'true' || item.disabled === true) status = 'disabled';

            const existing = await Customer.findOne({
                where: { server_id: serverId, mikrotik_name: item.name }
            });

            if (existing) {
                await existing.update({
                    profile: item.profile,
                    status: status
                });
                updated++;
            } else {
                await Customer.create({
                    server_id: serverId,
                    mikrotik_name: item.name,
                    profile: item.profile,
                    status: status,
                    name: item.comment || item.name
                });
                created++;
            }
        } catch (e) {
            console.error(`Error processing ${item.name}:`, e.message);
            errors++;
        }
    }

    console.log(`Sync Complete. Created: ${created}, Updated: ${updated}, Errors: ${errors}`);

    // Check count again
    const count = await Customer.count();
    console.log(`Total Customers in DB: ${count}`);
};

run().catch(console.error);
