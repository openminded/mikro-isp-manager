
import { initDB, Customer, Invoice, Server } from './models/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock getProfilesDB similarly to index.js
const DB_PROFILES_FILE = path.join(__dirname, 'data', 'profiles.json');
const getProfilesDB = () => {
    if (!fs.existsSync(DB_PROFILES_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(DB_PROFILES_FILE, 'utf8'));
    } catch (e) { return {}; }
};

async function debugInvoiceGeneration() {
    await initDB();

    console.log('--- Debugging Invoice Generation ---');

    // 1. Check Active Customers
    const activeCustomers = await Customer.findAll({ where: { status: 'active' } });
    console.log(`Found ${activeCustomers.length} active customers.`);

    if (activeCustomers.length === 0) {
        // Check total customers to see if it's a status issue
        const allCustomers = await Customer.findAll();
        console.log(`Total customers in DB: ${allCustomers.length}`);
        if (allCustomers.length > 0) {
            console.log('Sample customer status:', allCustomers[0].status);
        }
        return;
    }

    const period = new Date().toISOString().slice(0, 7);
    console.log(`Target Period: ${period}`);

    const profiles = getProfilesDB();
    console.log('Loaded Profiles DB keys:', Object.keys(profiles).slice(0, 5));

    for (const customer of activeCustomers) {
        console.log(`\nChecking Customer: ${customer.mikrotik_name} (ID: ${customer.id})`);
        console.log(`- Server ID: ${customer.server_id}`);
        console.log(`- Profile: ${customer.profile}`);

        // 2. Check Existing Invoice
        const exists = await Invoice.findOne({
            where: { customer_id: customer.id, period }
        });

        if (exists) {
            console.log(`- [SKIP] Invoice already exists for ${period} (Invoice ID: ${exists.id}, Status: ${exists.status})`);
            continue;
        }

        // 3. Check Price
        const key = `${customer.server_id}_${customer.profile}`;
        const price = profiles[key]?.price || 0;
        console.log(`- Profile Key: ${key}`);
        console.log(`- Price Found: ${price}`);

        if (price <= 0) {
            console.log(`- [SKIP] Price is 0 or missing for key: ${key}`);
            continue;
        }

        console.log(`- [SUCCESS] Would generate invoice!`);
    }
}

debugInvoiceGeneration().catch(console.error);
