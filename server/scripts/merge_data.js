import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Usage: node scripts/merge_data.js <target_file> <source_file>
// Example: node scripts/merge_data.js registrations.json registrations_local.json

const DATA_DIR = path.join(__dirname, '../data');

const targetFileName = process.argv[2] || 'registrations.json';
const sourceFileName = process.argv[3] || 'registrations_upload.json';

const targetPath = path.join(DATA_DIR, targetFileName);
const sourcePath = path.join(DATA_DIR, sourceFileName);

console.log(`[Merge] Target (Main): ${targetPath}`);
console.log(`[Merge] Source (New): ${sourcePath}`);

if (!fs.existsSync(targetPath)) {
    console.error('Target file does not exist. Initializing empty array if strictly needed, or just rename source.');
    // If target doesn't exist, we can just copy source to target
    if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, targetPath);
        console.log('Target did not exist. Copied source to target.');
        process.exit(0);
    } else {
        console.error('Neither file exists.');
        process.exit(1);
    }
}

if (!fs.existsSync(sourcePath)) {
    console.error(`Source file "${sourceFileName}" not found. Upload your local file with this name first.`);
    process.exit(1);
}

try {
    const targetData = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    const sourceData = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

    if (!Array.isArray(targetData) || !Array.isArray(sourceData)) {
        console.error('Both files must contain JSON Arrays.');
        process.exit(1);
    }

    console.log(`[Merge] Loaded ${targetData.length} existing items.`);
    console.log(`[Merge] Loaded ${sourceData.length} new items.`);

    let addedCount = 0;
    let updatedCount = 0;

    // Map existing for fast lookup
    const map = new Map();
    targetData.forEach(item => {
        if (item.id) map.set(item.id, item);
    });

    // Merge source into target
    sourceData.forEach(item => {
        if (!item.id) return;

        if (map.has(item.id)) {
            // Conflict: Item exists.
            // Option A: Skip (Safe preserve old)
            // Option B: Overwrite (Update)
            // For now, let's preserving OLD data (Server priority) if it exists, 
            // OR we can prefer Source if it's "newer". 
            // Since user asked "how not to lose OLD data", we should probably KEEP existing items.
            // But usually "Sync" means "Update".
            // Let's check a timestamp?
            // If strictly "Don't lose data", we only ADD missing IDs.

            // console.log(`[Skip] ID ${item.id} already exists.`);
        } else {
            // New Item
            targetData.push(item);
            map.set(item.id, item);
            addedCount++;
        }
    });

    fs.writeFileSync(targetPath, JSON.stringify(targetData, null, 2));
    console.log(`[Success] Merge complete.`);
    console.log(`   - Added: ${addedCount}`);
    console.log(`   - Total: ${targetData.length}`);

} catch (e) {
    console.error('Error parsing JSON:', e.message);
}
