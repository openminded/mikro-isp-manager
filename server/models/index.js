
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

// --- Models ---

export const Server = sequelize.define('Server', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    ip: { type: DataTypes.STRING, allowNull: false },
    port: { type: DataTypes.INTEGER, defaultValue: 8728 },
    username: { type: DataTypes.STRING, allowNull: false },
    password: { type: DataTypes.STRING, allowNull: true },
    default_billing_day: { type: DataTypes.INTEGER, defaultValue: 1, validate: { min: 1, max: 28 } },
    payment_due_days: { type: DataTypes.INTEGER, defaultValue: 7, validate: { min: 1, max: 30 } },
    isOnline: { type: DataTypes.BOOLEAN, defaultValue: false },
    installation_costs: { type: DataTypes.JSON, defaultValue: [] }, // List of { name, price }
    lat: { type: DataTypes.DECIMAL(10, 6), allowNull: true },
    lng: { type: DataTypes.DECIMAL(10, 6), allowNull: true }
});

export const Customer = sequelize.define('Customer', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    mikrotik_name: { type: DataTypes.STRING, allowNull: false }, // Username in PPPoE
    name: { type: DataTypes.STRING, allowNull: true }, // Real Name
    comment: { type: DataTypes.STRING, allowNull: true }, // Mikrotik Comment
    phone_number: { type: DataTypes.STRING, allowNull: true },
    profile: { type: DataTypes.STRING, allowNull: true },
    server_id: { type: DataTypes.UUID, allowNull: false }, // FK to Server
    custom_billing_day: { type: DataTypes.INTEGER, allowNull: true, validate: { min: 1, max: 28 } },
    status: { type: DataTypes.STRING, defaultValue: 'active' }, // active, isolated, disabled
    // Meta fields
    address: { type: DataTypes.STRING, allowNull: true },
    coordinates: { type: DataTypes.STRING, allowNull: true }, // lat,long
    odp_id: { type: DataTypes.STRING, allowNull: true },
    sub_area_id: { type: DataTypes.STRING, allowNull: true }, // Link to sub_areas.json
    photos: { type: DataTypes.JSON, defaultValue: [] },
    ktp: { type: DataTypes.STRING, allowNull: true },
    activationDate: { type: DataTypes.DATEONLY, allowNull: true },
    mapsUrl: { type: DataTypes.STRING, allowNull: true }, // Registration Location Link
    // Installation Data
    installationDate: { type: DataTypes.DATEONLY, allowNull: true },
    ssidName: { type: DataTypes.STRING, allowNull: true },
    ssidPassword: { type: DataTypes.STRING, allowNull: true },
    signalLevel: { type: DataTypes.STRING, allowNull: true } // Redaman
});

export const Invoice = sequelize.define('Invoice', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    customer_id: { type: DataTypes.UUID, allowNull: false },
    server_id: { type: DataTypes.UUID, allowNull: false }, // Snapshot for easier querying
    period: { type: DataTypes.STRING, allowNull: false }, // e.g. "2024-01"
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    status: { type: DataTypes.ENUM('UNPAID', 'PAID', 'CANCELLED', 'INVALID'), defaultValue: 'UNPAID' },
    due_date: { type: DataTypes.DATEONLY, allowNull: false },
    generated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

export const Payment = sequelize.define('Payment', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    invoice_id: { type: DataTypes.UUID, allowNull: false },
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    method: { type: DataTypes.STRING, allowNull: false }, // cash, bca, etc.
    proof_url: { type: DataTypes.STRING, allowNull: true },
    verified_at: { type: DataTypes.DATE, allowNull: true }, // Null if pending
    transaction_date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

export const InvoiceHistory = sequelize.define('InvoiceHistory', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    invoice_id: { type: DataTypes.UUID, allowNull: false },
    user_name: { type: DataTypes.STRING, allowNull: false },
    action: { type: DataTypes.STRING, allowNull: false },
    details: { type: DataTypes.TEXT, allowNull: true },
    timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
    tableName: 'invoice_audit_logs' // New table to avoid schema conflict with previous broken version
});

// --- Associations ---

Server.hasMany(Customer, { foreignKey: 'server_id' });
Customer.belongsTo(Server, { foreignKey: 'server_id' });

Customer.hasMany(Invoice, { foreignKey: 'customer_id' });
Invoice.belongsTo(Customer, { foreignKey: 'customer_id' });

Invoice.hasMany(Payment, { foreignKey: 'invoice_id', onDelete: 'CASCADE' });
Payment.belongsTo(Invoice, { foreignKey: 'invoice_id' });

Invoice.hasMany(InvoiceHistory, { foreignKey: 'invoice_id', onDelete: 'CASCADE' });
InvoiceHistory.belongsTo(Invoice, { foreignKey: 'invoice_id' });

// Function to sync database
export const initDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('[Database] Connection established successfully.');

        // Enable alter: true to sync new columns
        // [FIX] Disable alter: true to prevent SQLite corruption "table has 10 columns but 11 values supplied"
        // We handle critical schema updates manually below or via scripts.
        await sequelize.sync({ alter: false });

        // [MIGRATION-V3] Standardize all existing mikrotik_names to lowercase for consistency
        // This is critical for Linux-based production servers like aaPanel.
        console.log('[Database] Running mikrotik_name standardization (V3)...');
        const customersToFix = await Customer.findAll();
        for (const c of customersToFix) {
            const currentName = c.mikrotik_name || '';
            const lowerName = currentName.toLowerCase().trim();
            if (currentName !== lowerName) {
                await c.update({ mikrotik_name: lowerName });
                console.log(`[Database] Migrated: ${currentName} -> ${lowerName}`);
            }
        }
        console.log('[Database] Standardization complete.');

        // Explicitly check for sub_area_id column in Customers
        const tableInfo = await sequelize.getQueryInterface().describeTable('Customers');
        if (!tableInfo.sub_area_id) {
            console.log('[Database] Adding missing column sub_area_id to Customers...');
            await sequelize.getQueryInterface().addColumn('Customers', 'sub_area_id', {
                type: DataTypes.STRING,
                allowNull: true
            });
        }

        // Check for Server lat/lng
        const serverMapInfo = await sequelize.getQueryInterface().describeTable('Servers');
        if (!serverMapInfo.lat) {
            console.log('[Database] Adding missing column lat to Servers...');
            await sequelize.getQueryInterface().addColumn('Servers', 'lat', {
                type: DataTypes.DECIMAL(10, 6),
                allowNull: true
            });
        }
        if (!serverMapInfo.lng) {
            console.log('[Database] Adding missing column lng to Servers...');
            await sequelize.getQueryInterface().addColumn('Servers', 'lng', {
                type: DataTypes.DECIMAL(10, 6),
                allowNull: true
            });
        }

        if (!tableInfo.coordinates) {
            console.log('[Database] Adding missing column coordinates to Customers...');
            await sequelize.getQueryInterface().addColumn('Customers', 'coordinates', {
                type: DataTypes.STRING,
                allowNull: true
            });
        }

        if (!tableInfo.photos) {
            console.log('[Database] Adding missing column photos to Customers...');
            await sequelize.getQueryInterface().addColumn('Customers', 'photos', {
                type: DataTypes.JSON,
                allowNull: true,
                defaultValue: []
            });
        }

        if (!tableInfo.ktp) {
            console.log('[Database] Adding missing column ktp to Customers...');
            await sequelize.getQueryInterface().addColumn('Customers', 'ktp', {
                type: DataTypes.STRING,
                allowNull: true
            });
        }

        if (!tableInfo.activationDate) {
            console.log('[Database] Adding missing column activationDate to Customers...');
            await sequelize.getQueryInterface().addColumn('Customers', 'activationDate', {
                type: DataTypes.DATEONLY,
                allowNull: true
            });
        }

        if (!tableInfo.mapsUrl) {
            console.log('[Database] Adding missing column mapsUrl to Customers...');
            await sequelize.getQueryInterface().addColumn('Customers', 'mapsUrl', {
                type: DataTypes.STRING,
                allowNull: true
            });
        }
        
        if (!tableInfo.installationDate) {
            console.log('[Database] Adding missing column installationDate to Customers...');
            await sequelize.getQueryInterface().addColumn('Customers', 'installationDate', {
                type: DataTypes.DATEONLY,
                allowNull: true
            });
        }

        if (!tableInfo.ssidName) {
            console.log('[Database] Adding missing column ssidName to Customers...');
            await sequelize.getQueryInterface().addColumn('Customers', 'ssidName', {
                type: DataTypes.STRING,
                allowNull: true
            });
        }

        if (!tableInfo.ssidPassword) {
            console.log('[Database] Adding missing column ssidPassword to Customers...');
            await sequelize.getQueryInterface().addColumn('Customers', 'ssidPassword', {
                type: DataTypes.STRING,
                allowNull: true
            });
        }

        if (!tableInfo.signalLevel) {
            console.log('[Database] Adding missing column signalLevel to Customers...');
            await sequelize.getQueryInterface().addColumn('Customers', 'signalLevel', {
                type: DataTypes.STRING,
                allowNull: true
            });
        }

        if (!tableInfo.comment) {
            console.log('[Database] Adding missing column comment to Customers...');
            await sequelize.getQueryInterface().addColumn('Customers', 'comment', {
                type: DataTypes.STRING,
                allowNull: true
            });
        }

        const serverTableInfo = await sequelize.getQueryInterface().describeTable('Servers');
        if (!serverTableInfo.installation_costs) {
            console.log('[Database] Adding missing column installation_costs to Servers...');
            await sequelize.getQueryInterface().addColumn('Servers', 'installation_costs', {
                type: DataTypes.JSON,
                allowNull: true,
                defaultValue: []
            });
        }

        console.log('[Database] Models synchronized.');
    } catch (error) {
        console.error('[Database] Unable to connect or sync:', error);
    }
};
