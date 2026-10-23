import fs from 'fs';
import path from 'path';
import { Customer } from '../server/models/index.js';

async function test() {
    const custJsonPath = path.join(process.cwd(), 'server', 'data', 'customers.json');
    const custJson = JSON.parse(fs.readFileSync(custJsonPath, 'utf8'));

    for (const [key, meta] of Object.entries(custJson)) {
        // UUID is 36 chars: 8-4-4-4-12
        const serverId = key.slice(0, 36);
        const mikrotikName = key.slice(37);
        
        const sqlC = await Customer.findOne({
            where: {
                server_id: serverId,
                mikrotik_name: mikrotikName
            }
        });

        console.log(`Key: ${key}`);
        console.log(`  JSON: wa=${meta.whatsapp}, app_enabled=${meta.is_app_enabled}`);
        console.log(`  SQL: found=${!!sqlC}, id=${sqlC?.id}, phone=${sqlC?.phone_number}, app_enabled=${sqlC?.is_app_enabled}`);
    }
    process.exit(0);
}
test().catch(err => {
    console.error(err);
    process.exit(1);
});
