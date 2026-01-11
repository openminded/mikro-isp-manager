import routeros from 'node-routeros';
const { RouterOSAPI } = routeros;

const config = {
    host: '192.168.27.1',
    port: 8728,
    user: 'zk',
    password: 'AYDn2017!',
    timeout: 10
};

async function checkSecrets() {
    console.log('Class Name:', RouterOSAPI ? 'Found' : 'Missing');

    // NOTE: Depending on how node-routeros exports, we might need a different import.
    // Based on previous debug, we used:
    // import routeros from 'node-routeros'; const { RouterOSAPI } = routeros;

    const client = new RouterOSAPI({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        keepalive: false
    });

    try {
        console.log('Connecting...');
        await client.connect();
        console.log('Fetching secrets...');
        const secrets = await client.write(['/ppp/secret/print']);

        console.log('\n--- First 3 Secrets RAW Data ---');
        console.dir(secrets.slice(0, 3), { depth: null });

        client.close();
    } catch (e) {
        console.error(e);
        try { client.close(); } catch { }
    }
}

checkSecrets();
