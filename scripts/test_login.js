import { Customer, Server } from '../server/models/index.js';
import { Op } from 'sequelize';

async function testLogin(phone, inputPassword) {
    phone = String(phone).trim();
    inputPassword = String(inputPassword).trim();

    const cleanPhone = phone.replace(/\D/g, '');
    const phoneSuffix = cleanPhone.length >= 8 ? cleanPhone.slice(-8) : (cleanPhone.length >= 6 ? cleanPhone : null);

    const whereConditions = [
        { phone_number: phone },
        { mikrotik_name: phone },
        { mikrotik_name: phone.toLowerCase() }
    ];
    if (cleanPhone) {
        whereConditions.push({ phone_number: cleanPhone });
        whereConditions.push({ mikrotik_name: cleanPhone });
    }
    if (phoneSuffix) {
        whereConditions.push({ phone_number: { [Op.like]: `%${phoneSuffix}%` } });
    }

    const candidateCustomers = await Customer.findAll({
        where: {
            [Op.or]: whereConditions
        }
    });

    console.log(`Input: "${phone}", Found candidate customers: ${candidateCustomers.length}`);
    if (candidateCustomers.length === 0) {
        return { status: 401, error: 'Nomor HP atau Username tidak terdaftar sebagai pelanggan' };
    }

    const passwordMatches = candidateCustomers.filter(c => {
        const pwd = (c.password || 'giganusa!').trim();
        return pwd === inputPassword || (pwd === 'giganusa!' && inputPassword === 'nusantara!') || (pwd === 'nusantara!' && inputPassword === 'giganusa!');
    });

    console.log(`Password matches: ${passwordMatches.length}`);
    if (passwordMatches.length === 0) {
        return { status: 401, error: 'Kata sandi salah.' };
    }

    if (passwordMatches.length > 1) {
        const enabledAccounts = passwordMatches.filter(c => Boolean(c.is_app_enabled));
        if (enabledAccounts.length === 0) {
            return { status: 403, error: 'Akun anda belum di aktivasi, mohon hubungi admin' };
        }
        return { multiple: true, accounts: passwordMatches.map(c => ({ name: c.mikrotik_name, enabled: c.is_app_enabled })) };
    }

    const customer = passwordMatches[0];
    if (!customer.is_app_enabled) {
        return { status: 403, error: 'Akun anda belum di aktivasi, mohon hubungi admin' };
    }

    return { status: 200, success: true, customer: customer.mikrotik_name };
}

async function run() {
    console.log('Test 1 - rumah10:', await testLogin('rumah10', 'nusantara!'));
    console.log('Test 2 - zk-pranap:', await testLogin('zk-pranap', 'nusantara!'));
    console.log('Test 3 - zorokunti:', await testLogin('zorokunti', 'zzzz'));
    console.log('Test 4 - 6282288993664:', await testLogin('6282288993664', 'zzzz'));
    console.log('Test 5 - 123123213 (phone of rumah10):', await testLogin('123123213', 'nusantara!'));
    process.exit(0);
}
run();
