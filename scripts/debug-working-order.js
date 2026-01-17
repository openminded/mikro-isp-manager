import axios from 'axios';

async function check() {
    try {
        const res = await axios.get('http://localhost:3001/api/registrations');
        const regs = res.data;
        console.log(`Total Registrations: ${regs.length}`);

        const done = regs.filter(r => r.status === 'done');
        console.log(`Status 'done': ${done.length}`);

        const doneAndWO = regs.filter(r => r.status === 'done' && r.workingOrderStatus === 'done');
        console.log(`Status 'done' AND WO 'done': ${doneAndWO.length}`);

        doneAndWO.forEach(r => {
            console.log(`- ${r.fullName}: Status=${r.status}, WO=${r.workingOrderStatus}, Tech=${r.installation?.technician}`);
        });

    } catch (e) {
        console.error(e.message);
    }
}

check();
