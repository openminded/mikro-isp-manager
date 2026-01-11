import routeros from 'node-routeros';
const { RouterOSAPI } = routeros;

const config = {
    host: '192.168.27.1',
    port: 8728,
    user: 'zk',
    password: 'AYDn2017!',
    timeout: 10
};

console.log(`Connecting to ${config.host}:${config.port} as ${config.user}...`);

const client = new RouterOSAPI({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    keepalive: false
});

client.connect()
    .then(async () => {
        console.log('✅ Connection Successful!');
        console.log('Running /system/resource/print...');
        const loading = client.write('/system/resource/print');
        const data = await loading;
        console.log('✅ Data Received:');
        console.log(JSON.stringify(data, null, 2));
        client.close();
    })
    .catch(err => {
        console.error('❌ Connection Failed:', err.message);
        client.close();
    });
