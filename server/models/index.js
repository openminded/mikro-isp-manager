
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
    lng: { type: DataTypes.DECIMAL(10, 6), allowNull: true },
    hotspot_login_url: { type: DataTypes.STRING, allowNull: true } // e.g. "http://hotspot.net/login" or "http://10.10.10.1/login"
});

export const Customer = sequelize.define('Customer', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    mikrotik_name: { type: DataTypes.STRING, allowNull: false }, // Username in PPPoE
    name: { type: DataTypes.STRING, allowNull: true }, // Comment/Customer Name
    real_name: { type: DataTypes.STRING, allowNull: true }, // Actual Person Name
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
    signalLevel: { type: DataTypes.STRING, allowNull: true }, // Redaman
    // Consumer portal credentials
    password: { type: DataTypes.STRING, defaultValue: 'nusantara!' },
    must_change_password: { type: DataTypes.BOOLEAN, defaultValue: true }
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

export const RemoteDevice = sequelize.define('RemoteDevice', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    server_id: { type: DataTypes.UUID, allowNull: false },
    comment: { type: DataTypes.STRING, allowNull: false },
    dst_port: { type: DataTypes.STRING, allowNull: false },
    to_address: { type: DataTypes.STRING, allowNull: false },
    to_ports: { type: DataTypes.STRING, allowNull: false },
    protocol: { type: DataTypes.STRING, defaultValue: 'tcp' },
    last_check_status: { type: DataTypes.STRING, defaultValue: 'unknown' } // online, offline, unknown
});

export const OnuChangeLog = sequelize.define('OnuChangeLog', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    server_id: { type: DataTypes.UUID, allowNull: false },
    old_username: { type: DataTypes.STRING, allowNull: false },
    new_username: { type: DataTypes.STRING, allowNull: false },
    old_comment: { type: DataTypes.STRING, allowNull: true },
    user_name: { type: DataTypes.STRING, allowNull: false },
    timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

export const CustomerVoucher = sequelize.define('CustomerVoucher', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    customer_id: { type: DataTypes.UUID, allowNull: true },
    customer_name: { type: DataTypes.STRING, allowNull: true },
    customer_username: { type: DataTypes.STRING, allowNull: true },
    customer_phone: { type: DataTypes.STRING, allowNull: true },
    sub_area_name: { type: DataTypes.STRING, allowNull: true },
    server_id: { type: DataTypes.UUID, allowNull: false },
    server_name: { type: DataTypes.STRING, allowNull: true },
    voucher_code: { type: DataTypes.STRING, allowNull: false },
    voucher_password: { type: DataTypes.STRING, allowNull: true },
    profile: { type: DataTypes.STRING, defaultValue: 'default' },
    quota_gb: { type: DataTypes.INTEGER, allowNull: false },
    validity: { type: DataTypes.STRING, defaultValue: '30d' },
    status: { type: DataTypes.STRING, defaultValue: 'active' }, // active, used, expired
    login_url: { type: DataTypes.STRING, allowNull: true }, // Automatic 1-click login URL
    notes: { type: DataTypes.STRING, allowNull: true }
});

// --- Associations ---

Server.hasMany(Customer, { foreignKey: 'server_id', onDelete: 'CASCADE' });
Customer.belongsTo(Server, { foreignKey: 'server_id' });

Server.hasMany(CustomerVoucher, { foreignKey: 'server_id', onDelete: 'CASCADE' });
CustomerVoucher.belongsTo(Server, { foreignKey: 'server_id' });

Customer.hasMany(CustomerVoucher, { foreignKey: 'customer_id', onDelete: 'CASCADE' });
CustomerVoucher.belongsTo(Customer, { foreignKey: 'customer_id' });

Server.hasMany(Invoice, { foreignKey: 'server_id', onDelete: 'CASCADE' });
Invoice.belongsTo(Server, { foreignKey: 'server_id' });

Customer.hasMany(Invoice, { foreignKey: 'customer_id', onDelete: 'CASCADE' });
Invoice.belongsTo(Customer, { foreignKey: 'customer_id' });

Invoice.hasMany(Payment, { foreignKey: 'invoice_id', onDelete: 'CASCADE' });
Payment.belongsTo(Invoice, { foreignKey: 'invoice_id' });

Invoice.hasMany(InvoiceHistory, { foreignKey: 'invoice_id', onDelete: 'CASCADE' });
InvoiceHistory.belongsTo(Invoice, { foreignKey: 'invoice_id' });

Server.hasMany(RemoteDevice, { foreignKey: 'server_id', onDelete: 'CASCADE' });
RemoteDevice.belongsTo(Server, { foreignKey: 'server_id' });

Server.hasMany(OnuChangeLog, { foreignKey: 'server_id', onDelete: 'CASCADE' });
OnuChangeLog.belongsTo(Server, { foreignKey: 'server_id' });

// Function to sync database
export const initDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('[Database] Connection established successfully.');

        // Enable alter: true to sync new columns
        // [FIX] Disable alter: true to prevent SQLite corruption "table has 10 columns but 11 values supplied"
        // We handle critical schema updates manually below or via scripts.
        await sequelize.sync({ alter: false });

        // Explicitly check for missing columns in Customers and Servers before any model queries
        const tableInfo = await sequelize.getQueryInterface().describeTable('Customers');
        
        if (!tableInfo.sub_area_id) {
            console.log('[Database] Adding missing column sub_area_id to Customers...');
            await sequelize.getQueryInterface().addColumn('Customers', 'sub_area_id', {
                type: DataTypes.STRING,
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

        if (!tableInfo.real_name) {
            console.log('[Database] Adding missing column real_name to Customers...');
            await sequelize.getQueryInterface().addColumn('Customers', 'real_name', {
                type: DataTypes.STRING,
                allowNull: true
            });
        }

        if (!tableInfo.password) {
            console.log('[Database] Adding missing column password to Customers...');
            await sequelize.getQueryInterface().addColumn('Customers', 'password', {
                type: DataTypes.STRING,
                allowNull: true,
                defaultValue: 'nusantara!'
            });
        }

        if (!tableInfo.must_change_password) {
            console.log('[Database] Adding missing column must_change_password to Customers...');
            await sequelize.getQueryInterface().addColumn('Customers', 'must_change_password', {
                type: DataTypes.BOOLEAN,
                allowNull: true,
                defaultValue: true
            });
        }

        const serverTableInfo = await sequelize.getQueryInterface().describeTable('Servers');
        if (!serverTableInfo.lat) {
            console.log('[Database] Adding missing column lat to Servers...');
            await sequelize.getQueryInterface().addColumn('Servers', 'lat', {
                type: DataTypes.DECIMAL(10, 6),
                allowNull: true
            });
        }
        if (!serverTableInfo.lng) {
            console.log('[Database] Adding missing column lng to Servers...');
            await sequelize.getQueryInterface().addColumn('Servers', 'lng', {
                type: DataTypes.DECIMAL(10, 6),
                allowNull: true
            });
        }

        if (!serverTableInfo.installation_costs) {
            console.log('[Database] Adding missing column installation_costs to Servers...');
            await sequelize.getQueryInterface().addColumn('Servers', 'installation_costs', {
                type: DataTypes.JSON,
                allowNull: true,
                defaultValue: []
            });
        }

        if (!serverTableInfo.hotspot_login_url) {
            console.log('[Database] Adding missing column hotspot_login_url to Servers...');
            await sequelize.getQueryInterface().addColumn('Servers', 'hotspot_login_url', {
                type: DataTypes.STRING,
                allowNull: true
            });
        }

        const voucherTableInfo = await sequelize.getQueryInterface().describeTable('CustomerVouchers').catch(() => ({}));
        if (voucherTableInfo && !voucherTableInfo.login_url) {
            console.log('[Database] Adding missing column login_url to CustomerVouchers...');
            await sequelize.getQueryInterface().addColumn('CustomerVouchers', 'login_url', {
                type: DataTypes.STRING,
                allowNull: true
            }).catch(() => {});
        }

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

        // Ensure Database Indexes for High-Concurrency Performance
        await sequelize.query('CREATE INDEX IF NOT EXISTS idx_customers_phone ON Customers(phone_number);').catch(() => {});
        await sequelize.query('CREATE INDEX IF NOT EXISTS idx_customers_mikrotik_name ON Customers(mikrotik_name);').catch(() => {});
        await sequelize.query('CREATE INDEX IF NOT EXISTS idx_vouchers_customer_id ON CustomerVouchers(customer_id);').catch(() => {});
        await sequelize.query('CREATE INDEX IF NOT EXISTS idx_vouchers_customer_phone ON CustomerVouchers(customer_phone);').catch(() => {});
        await sequelize.query('CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON Invoices(customer_id);').catch(() => {});

        console.log('[Database] Models synchronized.');
        
        // Ensure RemoteDevices table exists
        await RemoteDevice.sync();
        await OnuChangeLog.sync();
        await CustomerVoucher.sync();
    } catch (error) {
        console.error('[Database] Unable to connect or sync:', error);
    }
};
