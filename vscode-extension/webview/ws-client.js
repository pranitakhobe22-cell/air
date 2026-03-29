/* ================================================================
   ws-client.js — Routes extension-host messages + CLI WebSocket
   ================================================================ */

let ws = null;
const RECONNECT_DELAY_MS = 3000;
let __currentWsUrl = null;

// ── Extension Host message router ───────────────────────────────
window.addEventListener('message', event => {
  const msg = event.data;

  // Chat module
  if (Chat && typeof Chat.handleMessage === 'function') {
    Chat.handleMessage(msg);
  }

  // Tab switching
  if (msg.type === 'switchTab') {
    UI.switchTab(msg.tab);
  }

  // WebSocket port from CLI runner
  if (msg.type === 'PORT_ALLOCATED') {
    console.log('[webview] WS port:', msg.port);
    __currentWsUrl = `ws://localhost:${msg.port}`;
    connect();
  }

  // ── Terminal output from extension host ──
  if (msg.type === 'terminalOutput') {
    UI.onTerminalOutput(msg);
  }
  if (msg.type === 'terminalDone') {
    UI.onTerminalDone(msg);
  }
  if (msg.type === 'terminalError') {
    UI.onTerminalError(msg);
  }
  if (msg.type === 'terminalClear') {
    UI.clearTerminal();
  }
});

// ── WebSocket → CLI runner ───────────────────────────────────────
function connect() {
  if (!__currentWsUrl) return;
  UI.setWsState('reconnecting');
  try {
    if (ws) ws.close();
    ws = new WebSocket(__currentWsUrl);
  } catch (err) {
    console.error('[ws-client] Construction failed:', err);
    UI.setWsState('disconnected');
    setTimeout(connect, RECONNECT_DELAY_MS);
    return;
  }
  ws.addEventListener('open',    () => { UI.setWsState('connected'); });
  ws.addEventListener('message', e => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    dispatch(msg);
  });
  ws.addEventListener('close',   () => { UI.setWsState('disconnected'); });
  ws.addEventListener('error',   () => { UI.setWsState('disconnected'); });
}

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
    default: break;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  UI.setWsState('disconnected');
});
