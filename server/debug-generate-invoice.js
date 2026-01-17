
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

    console.log('--- Generating Invoices Simulation ---');
    const activeCustomers = await Customer.findAll({ where: { status: 'active' } });
    const period = new Date().toISOString().slice(0, 7); // "2024-01"

    console.log(`Period: ${period}, Active Customers: ${activeCustomers.length}`);

    let count = 0;
    const profiles = getProfilesDB();

    for (const customer of activeCustomers) {
        // Check if invoice exists
        const exists = await Invoice.findOne({
            where: { customer_id: customer.id, period }
        });

        if (!exists) {
            const key = `${customer.server_id}_${customer.profile}`;
            const price = profiles[key]?.price || 0;

            if (price > 0) {
                console.log(`Creating invoice for ${customer.mikrotik_name}: ${price}`);
                await Invoice.create({
                    customer_id: customer.id,
                    server_id: customer.server_id,
                    period,
                    amount: price,
                    status: 'UNPAID',
                    due_date: new Date(new Date().setDate(new Date().getDate() + 7))
                });
                count++;
            } else {
                console.log(`Skipping ${customer.mikrotik_name}: Price is 0 (Key: ${key})`);
            }
        } else {
            // console.log(`Skipping ${customer.mikrotik_name}: Invoice exists`);
        }
    }

    console.log(`Generated ${count} invoices.`);
};

run().catch(console.error);
