import { Server as SocketIO } from 'socket.io';

export function createWsServer(httpServer) {
    const io = new SocketIO(httpServer, { cors: { origin: '*' } });

    io.on('connection', (socket) => {
        console.log(`  📡 wsServer dashboard connected (${socket.id})`);
        socket.on('disconnect', () => console.log(`  📡 Dashboard disconnected (${socket.id})`));
    });

    return io;
}
