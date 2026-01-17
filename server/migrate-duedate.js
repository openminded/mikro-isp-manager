
import sequelize from './config/database.js';

const run = async () => {
    try {
        await sequelize.authenticate();
        console.log('Connected to database.');

        const queryInterface = sequelize.getQueryInterface();
        await queryInterface.addColumn('Servers', 'payment_due_days', {
            type: 'INTEGER',
            defaultValue: 7
        });

        console.log('Migration successful: Added payment_due_days to Servers table.');
    } catch (e) {
        console.error('Migration failed:', e.message);
    }
};

run();
