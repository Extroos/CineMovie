import localtunnel from 'localtunnel';
import { spawn } from 'child_process';
import waitOn from 'wait-on';
import net from 'net';

const PORT = 3001;

// Robust port check: Try to listen on the port. If EADDRINUSE, it's taken.
const isPortInUse = (port) => new Promise((resolve) => {
    const tester = net.createServer()
        .once('error', (err) => {
            if (err.code === 'EADDRINUSE') resolve(true);
            else resolve(false);
        })
        .once('listening', () => {
             tester.close();
             resolve(false);
        })
        .listen(port);
});

(async () => {
    const inUse = await isPortInUse(PORT);
    let server;

    if (!inUse) {
        console.log('Starting Local Server...');
        server = spawn('npm', ['start'], { stdio: 'inherit', shell: true });
        
        // Cleanup on exit
        process.on('SIGINT', () => {
             if (server) server.kill();
             process.exit();
        });
    } else {
        console.log('Server is ALREADY running. Attaching tunnel...');
    }

    try {
        await waitOn({ resources: [`tcp:${PORT}`] });
        console.log('Server is active. Starting Tunnel...');
        
        const tunnel = await localtunnel({ port: PORT });
        console.log('\n=================================================');
        console.log('  🚀 PUBLIC URL:  ' + tunnel.url);
        console.log('=================================================\n');
        console.log('Copy this URL to the App Settings on your phone.\n');

        tunnel.on('close', () => {
            console.log('Tunnel closed');
        });
        
        if (!server) {
             // Keep process alive if only tunneling
             process.stdin.resume();
        }
    } catch (err) {
        console.error('Error:', err);
    }
})();
