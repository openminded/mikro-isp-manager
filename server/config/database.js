
import { Sequelize } from 'sequelize';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize SQLite Database
// We place the DB file in server/data/database.sqlite
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../data/database.sqlite'),
    logging: false, // Set to console.log to see SQL queries
});

export default sequelize;
