import { initDB, Invoice, InvoiceHistory, Payment } from '../models/index.js';
import { Op } from 'sequelize';

async function cleanup() {
    await initDB();

    try {
        const invalidInvoices = await Invoice.findAll({
            where: { status: { [Op.or]: ['INVALID', 'CANCELLED'] } }
        });

        if (invalidInvoices.length === 0) {
            console.log('No INVALID or CANCELLED invoices found.');
            return;
        }

        const formattedIds = invalidInvoices.map(inv => inv.id);
        console.log(`Found ${formattedIds.length} invalid/cancelled invoices. Deleting...`);

        // 1. Delete Related Payments
        const paymentsDeleted = await Payment.destroy({
            where: { invoice_id: formattedIds }
        });
        console.log(`- Deleted ${paymentsDeleted} related payments.`);

        // 2. Delete Related History
        const historyDeleted = await InvoiceHistory.destroy({
            where: { invoice_id: formattedIds }
        });
        console.log(`- Deleted ${historyDeleted} history logs.`);

        // 3. Delete Invoices
        const invoicesDeleted = await Invoice.destroy({
            where: { id: formattedIds }
        });
        console.log(`- Deleted ${invoicesDeleted} invoices.`);

        console.log('Cleanup complete!');

    } catch (error) {
        console.error('Error during cleanup:', error);
    }
}

cleanup();
