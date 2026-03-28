/* ================================================================
   ws-client.js (Webview Edition)
   Connects to the hosting server dynamically based on the port 
   passed down from the VS Code Extension Host.
   ================================================================ */

let ws = null;
const RECONNECT_DELAY_MS = 3000;
let __currentWsUrl = null;

// Listen for the dynamic port from the VS Code extension host
window.addEventListener('message', event => {
  const message = event.data;
  if (message.type === 'PORT_ALLOCATED') {
    console.log('[webview] Received port:', message.port);
    __currentWsUrl = `ws://localhost:${message.port}`;
    connect();
  }
});

function connect() {
  if (!__currentWsUrl) return;

  UI.setWsState('connecting');

  try {
    if (ws) {
        ws.close(); // close any existing before reconnecting
    }
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
    console.warn('[ws-client] Connection closed. Auto-reconnect is handled per session.');
    UI.setWsState('disconnected');
    // We do NOT infinite loop reconnect here, because the CLI runner ends and the port vanishes.
    // The next test run will send a new PORT_ALLOCATED event to trigger connection.
  });

  ws.addEventListener('error', (err) => {
    console.error('[ws-client] Error:', err);
  });
}

/* ── Event router ──────────────────────────────────────────── */
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

// Ensure the UI starts in a disconnected/waiting state
window.addEventListener('DOMContentLoaded', () => {
   UI.setWsState('disconnected'); 
   document.getElementById('hdr-file').textContent = 'Ready for next run…';

   // Bind to UI controls
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
