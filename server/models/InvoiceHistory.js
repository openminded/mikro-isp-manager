const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const InvoiceHistory = sequelize.define('InvoiceHistory', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    invoice_id: {
        type: DataTypes.STRING,
        allowNull: false
    },
    user_name: {
        type: DataTypes.STRING,
        allowNull: false // Name of the user who made the change
    },
    action: {
        type: DataTypes.STRING,
        allowNull: false // e.g., 'STATUS_UPDATE', 'EDIT', 'PAYMENT'
    },
    details: {
        type: DataTypes.TEXT,
        allowNull: true // JSON string or text describing the change
    },
    timestamp: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'invoice_history',
    timestamps: false
});

module.exports = InvoiceHistory;
