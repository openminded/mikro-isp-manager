const { Customer } = require('../models');
const { sequelize } = require('../config/database');

async function check() {
    try {
        await sequelize.authenticate();
        const count = await Customer.count();
        const withProfile = await Customer.count({ where: { profile: { [require('sequelize').Op.ne]: null } } });

        console.log(`Total Customers: ${count}`);
        console.log(`Customers with Profile: ${withProfile}`);

        if (count > 0) {
            const sample = await Customer.findOne();
            console.log('Sample Customer:', JSON.stringify(sample.toJSON(), null, 2));
        }
    } catch (e) {
        console.error(e);
    }
}

check();
