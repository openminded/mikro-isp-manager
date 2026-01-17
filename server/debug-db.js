
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDB, Customer, Invoice } from './models/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getProfilesDB = () => {
    const DB_PROFILES_FILE = path.join(__dirname, 'data', 'profiles.json');
    if (!fs.existsSync(DB_PROFILES_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(DB_PROFILES_FILE, 'utf8'));
    } catch (e) { return {}; }
};

const run = async () => {
    await initDB();

    console.log('--- Checking Customers ---');
    const activeCustomers = await Customer.findAll({ where: { status: 'active' } });
    console.log(`Found ${activeCustomers.length} active customers.`);

    const disabledCustomers = await Customer.findAll({ where: { status: 'disabled' } });
    console.log(`Found ${disabledCustomers.length} disabled customers.`);

    const profileDB = getProfilesDB();
    console.log(`Profiles DB has ${Object.keys(profileDB).length} entries.`);

    let matched = 0;
    let unmatched = 0;
    let zeroPrice = 0;

    if (activeCustomers.length > 0) {
        console.log('--- Checking Profile Mapping for Active Customers ---');
        for (const c of activeCustomers) {
            const key = `${c.server_id}_${c.profile}`;
            const profileData = profileDB[key];

            if (profileData) {
                matched++;
                if (!profileData.price || profileData.price === 0) {
                    zeroPrice++;
                    // console.log(`Zero Price: ${c.mikrotik_name} (Profile: ${c.profile})`);
                }
            } else {
                unmatched++;
                if (unmatched <= 5) {
                    console.log(`Unmatched Profile: ${c.mikrotik_name} -> Key: ${key}`);
                }
            }
        }
        console.log(`Matched: ${matched}, Unmatched: ${unmatched}, Zero Price: ${zeroPrice}`);
    }

    console.log('--- Checking Invoices ---');
    const period = new Date().toISOString().slice(0, 7);
    const invoices = await Invoice.findAll({ where: { period } });
    console.log(`Found ${invoices.length} invoices for period ${period}.`);
};

run().catch(console.error);
