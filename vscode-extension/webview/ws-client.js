/* ================================================================
   ws-client.js (Webview Edition)
   
   1. Routes extension-host messages to Chat and UI modules.
   2. Connects to the SelfHeal CLI WebSocket for live test runs.
   ================================================================ */

let ws = null;
const RECONNECT_DELAY_MS = 3000;
let __currentWsUrl = null;

// ── Listen for ALL messages from the VS Code Extension Host ─────
window.addEventListener('message', event => {
  const message = event.data;

  // Route to Chat module
  if (Chat && typeof Chat.handleMessage === 'function') {
    Chat.handleMessage(message);
  }

  // Tab switching (from extension host)
  if (message.type === 'switchTab') {
    UI.switchTab(message.tab);
  }

  // WebSocket port allocation (for dashboard live connection)
  if (message.type === 'PORT_ALLOCATED') {
    console.log('[webview] Received WS port:', message.port);
    __currentWsUrl = `ws://localhost:${message.port}`;
    connect();
  }
});

// ── WebSocket connection to CLI runner ──────────────────────────
function connect() {
  if (!__currentWsUrl) return;

  UI.setWsState('connecting');

  try {
    if (ws) ws.close();
    ws = new WebSocket(__currentWsUrl);
  } catch (err) {
    console.error('[ws-client] WebSocket construction failed:', err);
    UI.setWsState('disconnected');
    setTimeout(connect, RECONNECT_DELAY_MS);
    return;
  }

  ws.addEventListener('open', () => {
    console.log('[ws-client] Connected to', __currentWsUrl);
    UI.setWsState('connected');
  });

  ws.addEventListener('message', (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch (e) {
      console.warn('[ws-client] Non-JSON message ignored:', event.data);
      return;
    }
    console.log('[ws-client] ←', msg.type, msg);
    dispatch(msg);
  });

  ws.addEventListener('close', () => {
    console.warn('[ws-client] Connection closed.');
    UI.setWsState('disconnected');
  });

  ws.addEventListener('error', (err) => {
    console.error('[ws-client] Error:', err);
  });
}

/* ── Event router (dashboard events from CLI runner) ──────────── */
function dispatch(msg) {
  switch (msg.type) {
    case 'run:start':      UI.onRunStart(msg);      break;
    case 'step:start':     UI.onStepStart(msg);     break;
    case 'step:pass':      UI.onStepPass(msg);      break;
    case 'step:fail':      UI.onStepFail(msg);      break;
    case 'heal:start':     UI.onHealStart(msg);     break;
    case 'heal:reason':    UI.onHealReason(msg);    break;
    case 'heal:done':      UI.onHealDone(msg);      break;
    case 'run:done':       UI.onRunDone(msg);       break;
    case 'fragility:scan': UI.onFragilityScan(msg); break;
    default: console.log('[ws-client] Unknown event type:', msg.type);
  }
}

// ── DOM Ready ──────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  UI.setWsState('disconnected');
  UI.initTabs();

  // Bind dashboard control buttons
  document.getElementById('btn-run')?.addEventListener('click', () => {
    vscode.postMessage({ type: 'runTest' });
    document.getElementById('btn-run').style.display = 'none';
    document.getElementById('btn-stop').style.display = 'flex';
  });

  document.getElementById('btn-stop')?.addEventListener('click', () => {
    vscode.postMessage({ type: 'stopTest' });
    document.getElementById('btn-stop').style.display = 'none';
    document.getElementById('btn-run').style.display = 'flex';
  });
});
