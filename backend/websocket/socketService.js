/**
 * AERIS Backend — WebSocket Service
 * ────────────────────────────────────────────────────────────────
 * Manages real-time Socket.IO connections and broadcasts telemetry
 * and alert updates to all connected frontend clients.
 */

const { Server } = require('socket.io');

let io;

/**
 * Initialize the Socket.IO server on top of the HTTP server.
 */
const initWebSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: "*", // allow frontend connection strictly in dev; restrict in prod
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log(`[WS] Client connected: ${socket.id}`);

    // Optional: Clients can join specific rooms (e.g., specific sensor nodes)
    socket.on('join_node', (nodeId) => {
      socket.join(`node_${nodeId}`);
      console.log(`[WS] Client ${socket.id} joined room node_${nodeId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[WS] Client disconnected: ${socket.id}`);
    });
  });

  console.log('📡 WebSocket Server Initialized');
};

/**
 * Broadcast an environment update (telemetry) to all connected clients.
 * Optionally broadcast to a specific node room.
 */
const broadcastEnvironmentUpdate = (payload) => {
  if (!io) return;
  // payload structure: { nodeId, timestamp, sensors, derived }
  io.emit('environment_update', payload);
  // Example for specific room: io.to(`node_${payload.nodeId}`).emit('environment_update', payload);
};

/**
 * Broadcast an alert update to all connected clients.
 */
const broadcastAlertUpdate = (payload) => {
  if (!io) return;
  // payload structure: [ { nodeId, type, severity, message }, ... ]
  io.emit('alert_update', payload);
};

module.exports = {
  initWebSocket,
  broadcastEnvironmentUpdate,
  broadcastAlertUpdate
};

