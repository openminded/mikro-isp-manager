import { initDB, Invoice, Payment, Customer } from './models/index.js';

initDB().then(async () => {
  const invoices = await Invoice.findAll({
    where: { status: 'PAID' },
    include: [{ model: Payment, required: false }],
    limit: 2
  });
  
  const fs = await import('fs');
  fs.writeFileSync('test_invoice_payments.log', JSON.stringify(invoices, null, 2));
  console.log("Done");
  process.exit(0);
});
