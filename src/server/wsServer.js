import { WebSocketServer } from 'ws';

let wss;

export function createWsServer(server, port = 3001) {
    if (server) {
        wss = new WebSocketServer({ server });
        console.log(`  📡 WebSocket Server bound to HTTP server`);
    } else {
        wss = new WebSocketServer({ port });
        console.log(`  📡 WebSocket Server: ws://localhost:${port}`);
    }

    wss.on('connection', (ws) => {
        const actualPort = server ? server.address().port : port;
        console.log(`  📡 Dashboard connected on port ${actualPort}`);
        
        ws.on('close', () => {
            console.log(`  📡 Dashboard disconnected from port ${actualPort}`);
        });

        // Error handling
        ws.on('error', console.error);
    });

    return {
        // Mocking the socket.io interface if needed, but we'll use a direct broadcast
        emit: (event, data) => broadcast(event, data),
        on: (event, cb) => {
            if (event === 'connection') {
                wss.on('connection', cb);
            }
        }
    };
}

export function broadcast(type, data) {
    if (!wss) return;
    const message = JSON.stringify({ type, ...data });
    wss.clients.forEach((client) => {
        if (client.readyState === 1) { // 1 = OPEN
            client.send(message);
        }
    });
}
