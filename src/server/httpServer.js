/**
 * src/server/httpServer.js
 * ============================================================
 * Express HTTP server for the SelfHeal dashboard.
 *
 * Responsibilities
 * ─────────────────
 *  • Serve  dashboard/index.html  as the root route  GET /.
 *  • Serve the entire  dashboard/  directory as static assets
 *    (CSS, JS, images, etc. the UI ships with).
 *  • Expose a lightweight REST API for status and heal history.
 *  • Start only when the caller requests it (--dashboard flag).
 *  • Provide a graceful shutdown() method (used by CLI on SIGINT).
 *
 * Routes
 * ─────────────────
 *  GET  /                  → dashboard/index.html
 *  GET  /api/status        → { ok: true, uptime, port, clients }
 *  GET  /api/failures      → last N failure-bundle JSON files
 *  GET  /health            → 200 OK  (for process monitors / Docker)
 *
 * Usage
 * ─────
 *  import { createHttpServer } from './httpServer.js';
 *  const srv = await createHttpServer({ port: 3000 });
 *  // later …
 *  await srv.shutdown();
 * ============================================================
 */

import express from "express";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { createRequire } from "module";

// Resolve paths relative to the project root (two levels above src/server/)
const __dirname = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const DASHBOARD_DIR = path.join(PROJECT_ROOT, "dashboard");
const FAILURES_DIR = path.join(PROJECT_ROOT, ".selfheal-failures");

// ─────────────────────────────────────────────────────────────
// SECTION 1 — EXPRESS APP FACTORY
// ─────────────────────────────────────────────────────────────

/**
 * Build and configure the Express application.
 * Kept separate from the HTTP listener so it can be unit-tested
 * without actually binding to a port.
 *
 * @param {Object}  [opts={}]
 * @param {number}  [opts.port=3000]        - The port the server is listening on (for /api/status).
 * @param {Function}[opts.getClientCount]   - Optional fn returning live WS client count.
 * @returns {express.Application}
 */
function buildApp({ port = 3000, getClientCount = () => 0 } = {}) {
  const app = express();
  const startedAt = new Date();

  // ── Middleware ─────────────────────────────────────────────
  app.use(express.json());

  // Security: prevent clickjacking
  app.use((_req, res, next) => {
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
  });

  // ── Static assets (CSS, JS, images inside dashboard/) ─────
  if (existsSync(DASHBOARD_DIR)) {
    app.use(express.static(DASHBOARD_DIR, { index: false }));
  }

  // ── GET / — serve dashboard index.html ────────────────────
  app.get("/", (_req, res) => {
    const indexPath = path.join(DASHBOARD_DIR, "index.html");

    if (!existsSync(indexPath)) {
      // Graceful fallback when the dashboard hasn't been built yet
      return res.status(200).send(fallbackHtml(port));
    }

    res.sendFile(indexPath);
  });

  // ── GET /health — process-monitor heartbeat ────────────────
  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  // ── GET /api/status — runtime snapshot ────────────────────
  app.get("/api/status", (_req, res) => {
    res.json({
      ok: true,
      service: "selfheal-dashboard",
      port,
      wsClients: getClientCount(),
      uptime: Math.floor((Date.now() - startedAt.getTime()) / 1000),
      startedAt: startedAt.toISOString(),
      dashboardDir: DASHBOARD_DIR,
    });
  });

  // ── GET /api/failures — last N captured failure bundles ────
  app.get("/api/failures", async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit ?? "50", 10), 200);

    if (!existsSync(FAILURES_DIR)) {
      return res.json({ failures: [], total: 0 });
    }

    try {
      const files = (await fs.readdir(FAILURES_DIR))
        .filter((f) => f.endsWith(".json"))
        .sort()          // chronological (filenames have timestamps)
        .slice(-limit)   // most recent `limit` files
        .reverse();      // newest first

      const failures = await Promise.all(
        files.map(async (f) => {
          try {
            const raw = await fs.readFile(path.join(FAILURES_DIR, f), "utf8");
            return JSON.parse(raw);
          } catch {
            return { _file: f, _error: "Could not parse" };
          }
        })
      );

      res.json({ failures, total: files.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── 404 catch-all ──────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // ── Global error handler ───────────────────────────────────
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error(`[httpServer] unhandled error: ${err.message}`);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}

// ─────────────────────────────────────────────────────────────
// SECTION 2 — FALLBACK HTML
// ─────────────────────────────────────────────────────────────

/**
 * Minimal inline page served when dashboard/index.html doesn't exist yet.
 * Auto-connects to the WS server so it shows live events immediately.
 *
 * @param {number} httpPort
 * @returns {string}
 */
function fallbackHtml(httpPort) {
  const wsPort = httpPort + 1; // convention: wsPort = dashboardPort + 1
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SelfHeal — Dashboard</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      background: #0d1117;
      color: #e6edf3;
      font-family: 'Segoe UI', system-ui, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: 2rem;
    }
    header { margin-bottom: 2rem; text-align: center; }
    header h1 { font-size: 2rem; color: #58a6ff; letter-spacing: -0.5px; }
    header p  { color: #8b949e; margin-top: 0.4rem; }
    #status-bar {
      display: inline-flex; align-items: center; gap: 0.5rem;
      background: #161b22; border: 1px solid #30363d;
      border-radius: 6px; padding: 0.4rem 1rem;
      font-size: 0.85rem; margin-bottom: 1.5rem;
    }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #3fb950; }
    .dot.offline { background: #f85149; }
    #log {
      width: 100%; max-width: 860px;
      background: #161b22; border: 1px solid #30363d;
      border-radius: 8px; padding: 1rem;
      font-family: 'Cascadia Code', 'Fira Code', monospace;
      font-size: 0.8rem; line-height: 1.6;
      max-height: 70vh; overflow-y: auto;
    }
    .entry { padding: 0.25rem 0; border-bottom: 1px solid #21262d; }
    .entry:last-child { border-bottom: none; }
    .type { font-weight: 700; margin-right: 0.5rem; }
    .type.step\\:pass   { color: #3fb950; }
    .type.step\\:fail   { color: #f85149; }
    .type.step\\:start  { color: #58a6ff; }
    .type.heal\\:start  { color: #d2a8ff; }
    .type.heal\\:done   { color: #ffa657; }
    .type.run\\:done    { color: #58a6ff; }
    .type.server\\:ready { color: #3fb950; }
    .ts { color: #8b949e; font-size: 0.72rem; }
    #empty { color: #8b949e; font-style: italic; text-align: center; padding: 2rem; }
  </style>
</head>
<body>
  <header>
    <h1>⚡ SelfHeal</h1>
    <p>Live test run dashboard</p>
  </header>

  <div id="status-bar">
    <span class="dot offline" id="dot"></span>
    <span id="status-text">Connecting to ws://localhost:${wsPort} …</span>
  </div>

  <div id="log"><div id="empty">Waiting for events…</div></div>

  <script>
    const log     = document.getElementById('log');
    const dot     = document.getElementById('dot');
    const status  = document.getElementById('status-text');
    const TYPE_COLORS = {};

    function addEntry(frame) {
      const empty = document.getElementById('empty');
      if (empty) empty.remove();

      const el   = document.createElement('div');
      el.className = 'entry';

      const typeEl = document.createElement('span');
      typeEl.className = 'type ' + frame.type;
      typeEl.textContent = frame.type;

      const tsEl = document.createElement('span');
      tsEl.className = 'ts';
      tsEl.textContent = ' [' + new Date(frame.ts).toLocaleTimeString() + '] ';

      const bodyEl = document.createElement('span');
      // Show the most useful field per event type
      if (frame.type === 'step:fail')   bodyEl.textContent = frame.error?.message ?? '';
      else if (frame.type === 'run:done') bodyEl.textContent =
        'passed=' + frame.passed + ' failed=' + frame.failed + ' healed=' + frame.healed +
        ' (' + frame.durationMs + 'ms)';
      else if (frame.type === 'heal:done') bodyEl.textContent =
        'confidence=' + frame.healResult?.confidence + ' → ' + frame.healResult?.newSelector;
      else if (frame.stepCode) bodyEl.textContent = frame.stepCode.slice(0, 80);
      else bodyEl.textContent = frame.message ?? '';

      el.append(typeEl, tsEl, bodyEl);
      log.appendChild(el);
      log.scrollTop = log.scrollHeight;
    }

    function connect() {
      const ws = new WebSocket('ws://localhost:${wsPort}');

      ws.addEventListener('open', () => {
        dot.classList.remove('offline');
        status.textContent = 'Connected to ws://localhost:${wsPort}';
      });

      ws.addEventListener('message', (ev) => {
        try { addEntry(JSON.parse(ev.data)); } catch { /* ignore */ }
      });

      ws.addEventListener('close', () => {
        dot.classList.add('offline');
        status.textContent = 'Disconnected — reconnecting in 3 s…';
        setTimeout(connect, 3000);
      });

      ws.addEventListener('error', () => ws.close());

      // Keep-alive ping every 25 s
      const ping = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN)
          ws.send(JSON.stringify({ type: 'ping' }));
      }, 25_000);

      ws.addEventListener('close', () => clearInterval(ping));
    }

    connect();
  </script>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────
// SECTION 3 — HTTP SERVER CLASS
// ─────────────────────────────────────────────────────────────

export class HttpServer {
  /**
   * @param {import('http').Server}   server  - Node.js HTTP server.
   * @param {express.Application}     app     - Express app.
   * @param {number}                  port    - Bound port.
   */
  constructor(server, app, port) {
    this._server = server;
    this.app = app;
    this.port = port;
  }

  /**
   * Gracefully close the HTTP server (stops accepting new connections,
   * waits for existing requests to finish).
   *
   * @returns {Promise<void>}
   */
  async shutdown() {
    await new Promise((resolve, reject) => {
      this._server.close((err) => (err ? reject(err) : resolve()));
    });
    console.log(`[httpServer] stopped (was on port ${this.port})`);
  }
}

// ─────────────────────────────────────────────────────────────
// SECTION 4 — FACTORY
// ─────────────────────────────────────────────────────────────

/**
 * Start the Express HTTP server and resolve once it is listening.
 *
 * @param {Object}   [options={}]
 * @param {number}   [options.port=3000]          - Port to bind.
 * @param {string}   [options.host="localhost"]   - Bind host.
 * @param {Function} [options.getClientCount]     - Returns live WS client count for /api/status.
 * @returns {Promise<HttpServer>}
 *
 * @example
 * import { createHttpServer } from './httpServer.js';
 * const srv = await createHttpServer({ port: 3000 });
 * console.log(`Dashboard → http://localhost:${srv.port}`);
 * // …
 * await srv.shutdown();
 */
export async function createHttpServer(options = {}) {
  const { port = 3000, host = "localhost", getClientCount } = options;

  const app = buildApp({ port, getClientCount });

  const server = app.listen(port, host);

  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  console.log(`[httpServer] dashboard → http://${host}:${port}`);

  return new HttpServer(server, app, port);
}

export default createHttpServer;
