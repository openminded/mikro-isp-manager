
import { Sequelize, DataTypes } from 'sequelize';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database Config
const DATA_DIR = path.join(__dirname, '../server/data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(DATA_DIR, 'database.sqlite'),
    logging: console.log
});

const fixDatabase = async () => {
    try {
        await sequelize.authenticate();
        console.log('Connected to database.');

        const queryInterface = sequelize.getQueryInterface();
        const tableInfo = await queryInterface.describeTable('Customers');

        if (!tableInfo.sub_area_id) {
            console.log('Adding sub_area_id column...');
            await queryInterface.addColumn('Customers', 'sub_area_id', {
                type: DataTypes.STRING,
                allowNull: true
            });
            console.log('Column added successfully.');
        } else {
            console.log('Column sub_area_id already exists.');
        }

    } catch (error) {
        console.error('Error fixing database:', error);
    } finally {
        await sequelize.close();
    }
};

fixDatabase();
