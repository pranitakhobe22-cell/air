<<<<<<< HEAD
/* ================================================================
   ws-client.js
   Connects to the hosting server dynamically based on origin.
   Handles the Phase 3 WebSocket event contract and delegates
   every event to the matching ui.js function.
   ================================================================ */

const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${wsProtocol}//${window.location.host}`;
const RECONNECT_DELAY_MS = 3000;

let ws = null;

function connect() {
  UI.setWsState('connecting');

  try {
    ws = new WebSocket(WS_URL);
  } catch (err) {
    console.error('[ws-client] WebSocket construction failed:', err);
    UI.setWsState('disconnected');
    setTimeout(connect, RECONNECT_DELAY_MS);
    return;
  }

  ws.addEventListener('open', () => {
    console.log('[ws-client] Connected to', WS_URL);
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
    console.warn('[ws-client] Connection closed. Reconnecting in', RECONNECT_DELAY_MS, 'ms…');
    UI.setWsState('reconnecting');
    setTimeout(connect, RECONNECT_DELAY_MS);
  });

  ws.addEventListener('error', (err) => {
    console.error('[ws-client] Error:', err);
    // close event will fire next and trigger reconnect
  });
}

/* ── Event router ──────────────────────────────────────────── */
function dispatch(msg) {
  switch (msg.type) {

    // { type:'run:start', file:'checkout.spec.js', totalSteps:6 }
    case 'run:start':
      UI.onRunStart(msg);
      break;

    // { type:'step:start', index:2, name:'healClick #view-cart' }
    case 'step:start':
      UI.onStepStart(msg);
      break;

    // { type:'step:pass', index:2 }
    // { type:'step:pass', index:2, healed:true }
    case 'step:pass':
      UI.onStepPass(msg);
      break;

    // { type:'step:fail', index:2, error:'Element not found: #view-cart' }
    case 'step:fail':
      UI.onStepFail(msg);
      break;

    // { type:'heal:start', index:2 }
    case 'heal:start':
      UI.onHealStart(msg);
      break;

    // { type:'heal:reason', rootCause:'...', newSelector:'...', confidence:0.94 }
    case 'heal:reason':
      UI.onHealReason(msg);
      break;

    // { type:'heal:done', index:2, newSelector:'#cart-icon', healed:true }
    case 'heal:done':
      UI.onHealDone(msg);
      break;

    // { type:'run:done', passed:5, healed:2, failed:0, interventions:0 }
    case 'run:done':
      UI.onRunDone(msg);
      break;

    case 'fragility:scan':
      UI.onFragilityScan(msg);
      break;

    default:
      console.log('[ws-client] Unknown event type:', msg.type);
  }
}

// Kick off connection when the page loads
window.addEventListener('DOMContentLoaded', connect);
=======
const socket = io();

const timeline = document.getElementById('timeline');
const termLog = document.getElementById('terminal-log');
const statHeals = document.getElementById('stat-heals');
const statPassed = document.getElementById('stat-passed');
const statFailed = document.getElementById('stat-failed');

const sInd = document.getElementById('status-indicator');
const sTxt = document.getElementById('status-text');
const hdrTest = document.getElementById('hdr-testname');

const healPanel = document.getElementById('heal-panel');
const healStatus = document.getElementById('heal-status');
const approvalBox = document.getElementById('approval-box');

let passCount = 0, failCount = 0, healCount = 0;

function log(msg, type = 'info') {
  const time = new Date().toLocaleTimeString();
  let color = 'text-slate-300';
  if (type === 'error') color = 'text-rose-400';
  if (type === 'success') color = 'text-emerald-400';
  if (type === 'heal') color = 'text-sky-400';
  if (type === 'warn') color = 'text-amber-400';

  const line = document.createElement('div');
  line.className = 'log-line';
  line.innerHTML = `<span class="log-time">[${time}]</span> <span class="${color}">${msg}</span>`;
  termLog.appendChild(line);
  termLog.scrollTop = termLog.scrollHeight;
}

function addStepCard(data, type) {
  if (timeline.querySelector('.italic')) timeline.innerHTML = '';
  const card = document.createElement('div');
  card.className = `p-3 rounded-xl glass-panel step-card step-${type} bg-opacity-20`;

  let icon = type === 'pass' ? '✅' : type === 'fail' ? '❌' : '✨';

  card.innerHTML = `
        <div class="flex justify-between items-start">
          <div class="flex gap-2">
            <span>${icon}</span>
            <div>
              <div class="font-semibold text-sm capitalize">${data.action}</div>
              <div class="font-mono text-xs text-slate-400 mt-1">${data.selector}</div>
            </div>
          </div>
        </div>
      `;
  timeline.appendChild(card);
  timeline.scrollTop = timeline.scrollHeight;
}

socket.on('run:start', (data) => {
  hdrTest.innerText = data.testFile;
  sInd.className = 'status-dot status-running pulse';
  sTxt.innerText = 'Running';
  timeline.innerHTML = ''; termLog.innerHTML = '';
  passCount = failCount = healCount = 0;
  statPassed.innerText = passCount; statFailed.innerText = failCount; statHeals.innerText = healCount;
  log(`Started run: ${data.testFile}`, 'info');
  healPanel.style.opacity = '0.5';
  healStatus.innerHTML = 'Quiet. AI is standing by.';
  approvalBox.classList.add('hidden');
});

socket.on('step:start', (data) => log(`Executing: ${data.action} -> ${data.selector}`));

socket.on('step:pass', (data) => {
  passCount++; statPassed.innerText = passCount;
  addStepCard(data, 'pass'); log(`Passed: ${data.selector}`, 'success');
});

socket.on('step:fail', (data) => {
  failCount++; statFailed.innerText = failCount;
  addStepCard(data, 'fail'); log(`Failed: ${data.selector}`, 'error');
});

let healTimerInterval;
let healStartTime;

socket.on('heal:start', (data) => {
  healPanel.style.opacity = '1';
  document.getElementById('fragility-warning').classList.remove('hidden');
  healStartTime = Date.now();

  healStatus.innerHTML = `
        <span class="text-sky-400 font-semibold animate-pulse">Invoking Intent Layer + Gemini AI...</span>
        <div class="text-xs font-mono bg-black/30 p-2 rounded mt-2 text-rose-400">${data.selector}</div>
        <div id="heal-timer" class="text-xs text-slate-500 mt-2 font-mono">Time spent healing: 0.0s</div>
      `;
  log(`Healer activated!`, 'heal');

  healTimerInterval = setInterval(() => {
    const t = document.getElementById('heal-timer');
    if (t) t.innerText = `Time spent healing: ${((Date.now() - healStartTime) / 1000).toFixed(1)}s`;
  }, 100);
});

socket.on('heal:result', (data) => {
  clearInterval(healTimerInterval);
  if (!data.newSelector) {
    healStatus.innerHTML = `<div class="text-rose-400 font-semibold text-2xl">AI failed to find a fix.</div>`;
    return;
  }

  const conf = Math.round(data.confidence * 100);
  const confColor = conf >= 80 ? 'text-emerald-400' : 'text-rose-400';
  const timeTaken = ((Date.now() - healStartTime) / 1000).toFixed(1);

  healStatus.innerHTML = `
        <div class="text-sky-400 font-semibold mb-2">Intent matched!</div>
        <div class="text-xs text-slate-300 mb-2">Confidence: <span class="font-bold ${confColor} text-[48px] leading-none">${conf}%</span></div>
        <div class="text-xl text-white font-bold bg-black/30 p-3 rounded mx-auto">" ${data.rootCause} "</div>
        <div class="text-xs text-slate-500 mt-2 font-mono">Found in ${timeTaken}s</div>
      `;
  log(`Model proposed: ${data.newSelector}`, 'heal');
});

socket.on('heal:confirm', (data) => {
  approvalBox.classList.remove('hidden');
  document.getElementById('approve-conf').innerText = Math.round(data.confidence * 100);
  document.getElementById('approve-old').innerText = data.brokenSelector;
  document.getElementById('approve-new').innerText = data.suggestedSelector;
});

socket.on('step:healed', (data) => {
  healCount++; statHeals.innerText = healCount;
  passCount++; statPassed.innerText = passCount;
  failCount--; statFailed.innerText = failCount;

  // Override text for "HEALED" status in the timeline
  const stepData = { ...data, action: '<span class="text-amber-400 font-bold tracking-widest uppercase">HEALED</span> ' + data.action };
  addStepCard(stepData, 'healed');
  log(`✨ Step successfully healed! File patched.`, 'success');

  setTimeout(() => {
    healPanel.style.opacity = '0.5';
    healStatus.innerHTML = 'Quiet. AI is standing by.';
    document.getElementById('fragility-warning').classList.add('hidden');
  }, 5000);
});

socket.on('run:complete', (data) => {
  sInd.className = `status-dot ${data.status === 'passed' ? 'status-success' : 'status-failed'}`;
  sTxt.innerText = `Complete`;
  log(`Run completed.`, data.status === 'passed' ? 'success' : 'error');

  // Full Screen Overlay Logic (Phase 4)
  const overlay = document.getElementById('run-summary-overlay');
  if (overlay) {
    document.getElementById('overlay-steps').innerText = (passCount + failCount).toString();
    document.getElementById('overlay-healed').innerText = healCount.toString();
    document.getElementById('overlay-interventions').innerText = '0';
    document.getElementById('overlay-time').innerText = data.duration || '6.2s';

    overlay.classList.remove('hidden');
    setTimeout(() => { overlay.style.opacity = '1'; }, 50);
  }
});

socket.on('fragility:data', (scores) => {
  const container = document.getElementById('fragility-scans');
  if (!scores || scores.length === 0) return;
  container.innerHTML = '';
  scores.forEach(s => {
    const card = document.createElement('div');
    const color = s.score > 50 ? 'text-rose-400' : (s.score > 20 ? 'text-amber-400' : 'text-emerald-400');
    const bg = s.score > 50 ? 'bg-rose-500/10' : (s.score > 20 ? 'bg-amber-500/10' : 'bg-emerald-500/10');

    card.className = `p-3 rounded-xl border border-white/5 ${bg} space-y-1`;
    card.innerHTML = `
          <div class="flex justify-between items-center">
            <span class="text-[10px] font-mono text-slate-400 truncate w-3/4">${s.selector}</span>
            <span class="text-xs font-bold ${color}">${s.score}%</span>
          </div>
          <div class="text-[10px] text-slate-500 italic">${s.reasons[0] || 'Good selector'}</div>
        `;
    container.appendChild(card);
  });
  log(`Received fragility scan for ${scores.length} selectors.`, 'warn');
});

document.getElementById('btn-approve').addEventListener('click', () => {
  socket.emit('heal:approve'); approvalBox.classList.add('hidden');
});
document.getElementById('btn-reject').addEventListener('click', () => {
  socket.emit('heal:reject'); approvalBox.classList.add('hidden');
});
>>>>>>> origin/phase-4
