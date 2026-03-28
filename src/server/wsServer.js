/**
 * src/server/wsServer.js
 * ============================================================
 * WebSocket broadcast server for the SelfHeal dashboard.
 *
 * Responsibilities
 * ─────────────────
 *  • Start a `ws` WebSocket server on a configurable port (default 3001).
 *  • Accept any number of dashboard / CLI client connections.
 *  • Bridge a PlaywrightRunner EventEmitter → WS broadcast:
 *      runner event  →  JSON frame  →  every connected client.
 *  • Event wire format (always a JSON string):
 *      { "type": "<event-name>", ...payload fields }
 *  • Handle client connect / disconnect cleanly.
 *  • Expose a graceful shutdown method.
 *  • Never throw into the caller on individual client send errors.
 *
 * Runner events bridged
 * ─────────────────────
 *  step:start   step:pass   step:fail
 *  heal:start   heal:done   run:done
 *  (plus a synthetic "server:ready" and "server:shutdown" for the UI)
 *
 * Usage
 * ─────
 *  import { createWsServer } from './wsServer.js';
 *  const wss = await createWsServer(runner, { port: 3001 });
 *  // later …
 *  await wss.shutdown();
 * ============================================================
 */

import { WebSocketServer, WebSocket } from "ws";

// ─────────────────────────────────────────────────────────────
// SECTION 1 — CONSTANTS
// ─────────────────────────────────────────────────────────────

/** All runner events the server will bridge to WS clients. */
const RUNNER_EVENTS = [
  "step:start",
  "step:pass",
  "step:fail",
  "heal:start",
  "heal:done",
  "run:done",
];

/** How long (ms) to wait for the HTTP upgrade handshake before dropping. */
const HANDSHAKE_TIMEOUT_MS = 10_000;

// ─────────────────────────────────────────────────────────────
// SECTION 2 — SERIALISER
// ─────────────────────────────────────────────────────────────

/**
 * Convert a runner event name + payload into the wire JSON string.
 *
 * Wire format:  { "type": "<event-name>", ...payloadFields }
 *
 * Large binary fields (screenshots, DOM snapshots) are stripped from
 * WS frames to keep them small — the dashboard fetches those separately
 * via the REST API.  A `_truncated` flag is added when stripping occurs.
 *
 * @param {string} eventName  - e.g. "step:fail"
 * @param {Object} payload    - Raw event payload from the runner.
 * @returns {string}          - JSON-encoded wire frame.
 */
function serialise(eventName, payload) {
  let safe = { ...payload };
  let truncated = false;

  // Strip heavy binary fields — they'd bloat every WS frame.
  if (safe.failureBundle) {
    const { screenshotBase64, domSnapshot, ...rest } = safe.failureBundle;
    safe = { ...safe, failureBundle: { ...rest, _truncated: !!(screenshotBase64 || domSnapshot) } };
    truncated = true;
  }

  // Limit error stack traces to first 500 chars to keep frames readable.
  if (safe.error?.stack) {
    safe = {
      ...safe,
      error: { ...safe.error, stack: safe.error.stack.slice(0, 500) },
    };
  }

  const frame = {
    type: eventName,
    ts: new Date().toISOString(),
    ...(truncated ? { _truncated: true } : {}),
    ...safe,
  };

  try {
    return JSON.stringify(frame);
  } catch {
    // Circular references or non-serialisable values — send a safe fallback.
    return JSON.stringify({
      type: eventName,
      ts: frame.ts,
      _serializeError: true,
      message: "Payload could not be serialised; check server logs.",
    });
  }
}

// ─────────────────────────────────────────────────────────────
// SECTION 3 — BROADCAST HELPER
// ─────────────────────────────────────────────────────────────

/**
 * Send `message` to every currently open client socket.
 * Individual send errors are caught and logged — a single bad socket
 * must never prevent delivery to healthy clients.
 *
 * @param {WebSocketServer} wss      - The ws server instance.
 * @param {string}          message  - Pre-serialised JSON string.
 */
function broadcast(wss, message) {
  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) continue;
    try {
      client.send(message);
    } catch (err) {
      // Non-fatal — stale or lagging client
      console.warn(`[wsServer] send error (client dropped?): ${err.message}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// SECTION 4 — RUNNER → WS BRIDGE
// ─────────────────────────────────────────────────────────────

/**
 * Attach listeners to `runner` for every known runner event and
 * broadcast each event as a JSON frame to all WS clients.
 *
 * Returns the array of listener functions so they can be detached
 * cleanly during shutdown.
 *
 * @param {import('events').EventEmitter} runner
 * @param {WebSocketServer}               wss
 * @returns {Array<{ event: string, listener: Function }>}
 */
function attachRunnerBridge(runner, wss) {
  const attached = [];

  for (const eventName of RUNNER_EVENTS) {
    const listener = (payload) => {
      const message = serialise(eventName, payload ?? {});
      broadcast(wss, message);
    };

    runner.on(eventName, listener);
    attached.push({ event: eventName, listener });
  }

  return attached;
}

/**
 * Remove all previously attached runner listeners.
 *
 * @param {import('events').EventEmitter}         runner
 * @param {Array<{ event: string, listener: Function }>} attached
 */
function detachRunnerBridge(runner, attached) {
  for (const { event, listener } of attached) {
    runner.off(event, listener);
  }
}

// ─────────────────────────────────────────────────────────────
// SECTION 5 — SERVER CLASS
// ─────────────────────────────────────────────────────────────

export class WsServer {
  /**
   * @param {WebSocketServer}               wss      - Underlying ws server.
   * @param {import('events').EventEmitter} runner   - PlaywrightRunner instance.
   * @param {Array}                         attached - Attached bridge listeners.
   */
  constructor(wss, runner, attached) {
    this._wss = wss;
    this._runner = runner;
    this._attached = attached;
  }

  /** Number of currently connected clients. */
  get clientCount() {
    return this._wss.clients.size;
  }

  /** The underlying ws.WebSocketServer instance (for advanced use). */
  get rawServer() {
    return this._wss;
  }

  /**
   * Broadcast an arbitrary event to all connected clients.
   * Useful for synthetic events (e.g. "server:info") from the CLI layer.
   *
   * @param {string} type     - Event type label.
   * @param {Object} [payload] - Additional fields to merge into the frame.
   */
  send(type, payload = {}) {
    const message = serialise(type, payload);
    broadcast(this._wss, message);
  }

  /**
   * Gracefully shut down the WebSocket server.
   *  1. Detaches all runner listeners.
   *  2. Broadcasts a "server:shutdown" notice to clients.
   *  3. Closes all open client connections.
   *  4. Closes the server socket.
   *
   * @returns {Promise<void>}
   */
  async shutdown() {
    detachRunnerBridge(this._runner, this._attached);

    // Notify clients before closing
    this.send("server:shutdown", { message: "SelfHeal WS server is shutting down." });

    // Close every client connection
    for (const client of this._wss.clients) {
      try {
        client.terminate();
      } catch {
        // already gone
      }
    }

    // Close the server socket
    await new Promise((resolve, reject) => {
      this._wss.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

// ─────────────────────────────────────────────────────────────
// SECTION 6 — FACTORY
// ─────────────────────────────────────────────────────────────

/**
 * Create and start a WebSocket server bound to `port`, bridged to `runner`.
 *
 * @param {import('events').EventEmitter} runner   - A PlaywrightRunner instance.
 * @param {Object}  [options={}]
 * @param {number}  [options.port=3001]            - Port to listen on.
 * @param {string}  [options.host="localhost"]     - Bind host.
 * @returns {Promise<WsServer>}
 *
 * @example
 * import PlaywrightRunner       from '../runner/playwrightRunner.js';
 * import { createWsServer }     from './wsServer.js';
 *
 * const runner = new PlaywrightRunner(config);
 * const wss    = await createWsServer(runner, { port: 3001 });
 *
 * runner.run('/abs/path/test.spec.js');  // events flow → WS clients
 *
 * // Later:
 * await wss.shutdown();
 */
export async function createWsServer(runner, options = {}) {
  const { port = 3001, host = "localhost" } = options;

  const wss = new WebSocketServer({
    port,
    host,
    handshakeTimeout: HANDSHAKE_TIMEOUT_MS,
    // Allow any origin — dashboard is served locally
    verifyClient: () => true,
  });

  // ── Client lifecycle logging ──────────────────────────────
  wss.on("connection", (socket, req) => {
    const clientAddr = req.socket.remoteAddress ?? "unknown";
    console.log(`[wsServer] client connected  (${clientAddr}) — total: ${wss.clients.size}`);

    // Immediately send the current server state so late-joining dashboards
    // can render a "connected, waiting for run" screen.
    try {
      socket.send(
        serialise("server:ready", {
          message: "Connected to SelfHeal WebSocket server.",
          clientCount: wss.clients.size,
        })
      );
    } catch {
      // Ignore if socket closes immediately
    }

    socket.on("close", (code, reason) => {
      console.log(
        `[wsServer] client disconnected (${clientAddr}) code=${code}` +
        (reason?.length ? ` reason=${reason}` : "") +
        ` — remaining: ${wss.clients.size}`
      );
    });

    socket.on("error", (err) => {
      console.warn(`[wsServer] client socket error (${clientAddr}): ${err.message}`);
    });

    // Respond to pings from client-side keep-alive logic
    socket.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "ping") {
          socket.send(JSON.stringify({ type: "pong", ts: new Date().toISOString() }));
        }
        // Any other client → server messages can be handled here in future
      } catch {
        // Not valid JSON — ignore silently
      }
    });
  });

  wss.on("error", (err) => {
    console.error(`[wsServer] server error: ${err.message}`);
  });

  // ── Wait for server to be listening ──────────────────────
  await new Promise((resolve, reject) => {
    wss.once("listening", resolve);
    wss.once("error", reject);
  });

  console.log(`[wsServer] listening on ws://${host}:${port}`);

  // ── Bridge runner events → WS broadcast ──────────────────
  const attached = attachRunnerBridge(runner, wss);

  return new WsServer(wss, runner, attached);
}

export default createWsServer;
