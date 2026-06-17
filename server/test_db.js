import { initDB, Payment, Invoice } from './models/index.js';

initDB().then(async () => {
  const payments = await Payment.findAll({ order: [['transaction_date', 'DESC']], limit: 5 });
  console.log("PAYMENTS:", JSON.stringify(payments, null, 2));
  process.exit(0);
});
