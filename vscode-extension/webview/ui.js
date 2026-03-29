/* ================================================================
   ui.js — Dashboard DOM + Terminal Tab + Tab System
   ================================================================ */

const UI = (() => {
  const $ = id => document.getElementById(id);

  /* ── Element refs ── */
  const els = {
    wsDot:        $('ws-dot'),
    stepList:     $('step-list'),
    stepEmpty:    $('step-empty'),
    stepBadge:    $('step-badge'),
    healBadge:    $('heal-badge'),
    healIdle:     $('heal-idle'),
    healSpinner:  $('heal-spinner'),
    healContent:  $('heal-content'),
    healRootCause:$('heal-root-cause'),
    healOldSel:   $('heal-old-sel'),
    healNewSel:   $('heal-new-sel'),
    confNumber:   $('conf-number'),
    confBar:      $('conf-bar'),
    confLabel:    $('conf-label'),
    statTotal:    $('stat-total'),
    statPassed:   $('stat-passed'),
    statHealed:   $('stat-healed'),
    statFailed:   $('stat-failed'),
    statInterv:   $('stat-interv'),
    runStatus:    $('run-status'),
    runStatusTxt: $('run-status-text'),
    fragilityPanel: $('fragility-panel'),
    fragilityList:  $('fragility-list'),
    healTimer:    $('heal-timer'),
    runOverlay:   $('run-overlay'),
    ovTotal:      $('ov-total'),
    ovHealed:     $('ov-healed'),
    ovInterv:     $('ov-interv'),
    ovTime:       $('ov-time'),
    ovIcon:       $('overlay-icon'),
    /* Terminal */
    termOutput:   $('term-output'),
    termEmpty:    $('term-empty'),
    termInput:    $('term-input'),
    termRunBtn:   $('term-run-btn'),
    termKillBtn:  $('term-kill-btn'),
    termRunningIndicator: $('term-running-indicator'),
    termRunningCmd: $('term-running-cmd'),
    termQuickStop:  $('term-quick-stop'),
  };

  /* ── State ── */
  let state = { totalSteps: 0, steps: {}, completedSteps: 0, currentHealIndex: null, currentHealOldSel: null };
  let _runStartTime = null, _healStartTime = null, _healTimerRaf = null;
  let _termBusy = false;

  /* ══════ TAB SYSTEM ══════ */
  function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    initTerminal();
  }

  function switchTab(name) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === name));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${name}`));
  }

  /* ══════ TERMINAL TAB ══════ */
  function initTerminal() {
    if (!els.termInput) return;

    // Enter to run
    els.termInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runTerminalCmd(); }
    });
    if (els.termRunBtn) els.termRunBtn.addEventListener('click', runTerminalCmd);
    if (els.termKillBtn) els.termKillBtn.addEventListener('click', killTerminalCmd);

    // Quick launch buttons
    document.querySelectorAll('.term-quick-btn[data-cmd]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cmd = btn.dataset.cmd;
        if (cmd === 'run' || cmd === 'scan' || cmd === 'panel') {
          // For run/scan, pass the cmd to extension to get active file
          if (!_termBusy) {
            vscode.postMessage({ type: 'runTerminalCommand', cmd, useActiveFile: true });
            setTerminalBusy(true, `selfheal ${cmd}`);
            appendTermLine(`selfheal ${cmd} <active file>`, 'cmd');
          }
        }
      });
    });

    const stopBtn = $('term-quick-stop');
    if (stopBtn) stopBtn.addEventListener('click', killTerminalCmd);
  }

  function runTerminalCmd() {
    if (!els.termInput || _termBusy) return;
    const raw = els.termInput.value.trim();
    if (!raw) return;
    els.termInput.value = '';
    appendTermLine(raw, 'cmd');
    vscode.postMessage({ type: 'runTerminalCommand', cmd: raw, useActiveFile: false });
    setTerminalBusy(true, raw);
  }

  function killTerminalCmd() {
    vscode.postMessage({ type: 'killTerminalCommand' });
    appendTermLine('Process interrupted (Ctrl+C)', 'system');
    setTerminalBusy(false);
  }

  function setTerminalBusy(busy, cmdLabel) {
    _termBusy = busy;
    if (els.termRunBtn)  els.termRunBtn.disabled = busy;
    if (els.termKillBtn) els.termKillBtn.classList.toggle('show', busy);
    if (els.termQuickStop) els.termQuickStop.style.display = busy ? 'flex' : 'none';
    if (els.termRunningIndicator) els.termRunningIndicator.classList.toggle('show', busy);
    if (busy && els.termRunningCmd && cmdLabel) els.termRunningCmd.textContent = `Running: ${cmdLabel}`;
  }

  function appendTermLine(text, type = 'stdout') {
    if (!els.termOutput) return;
    // Hide the empty placeholder
    if (els.termEmpty) els.termEmpty.style.display = 'none';

    const line = document.createElement('div');
    line.className = `term-line ${type}`;
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    line.innerHTML = `<span class="term-line-prefix">${ts}</span><span class="term-line-text">${escapeTermText(text)}</span>`;
    els.termOutput.appendChild(line);
    els.termOutput.scrollTop = els.termOutput.scrollHeight;
  }

  function showTerminalError(errorMsg) {
    if (!els.termOutput) return;
    if (els.termEmpty) els.termEmpty.style.display = 'none';

    const card = document.createElement('div');
    card.className = 'term-error-card';
    card.innerHTML = `
      <div class="term-error-header">
        <div class="term-error-label">
          <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/></svg>
          Error Detected
        </div>
      </div>
      <div class="term-error-body">
        <div class="term-error-msg">${escapeTermText(errorMsg.slice(0, 400))}</div>
      </div>
      <div class="term-error-footer">
        <button class="term-ask-ai-btn" data-error="${escapeAttr(errorMsg)}">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="white"><path d="M12 2l1.68 4.06C15.37 10.13 17.87 12.63 21.94 14.32L26 16l-4.06 1.68C17.87 19.37 15.37 21.87 13.68 25.94L12 30l-1.68-4.06C8.63 21.87 6.13 19.37 2.06 17.68L-2 16l4.06-1.68C6.13 12.63 8.63 10.13 10.32 6.06L12 2z"/></svg>
          Ask AI to Fix
        </button>
      </div>`;

    card.querySelector('.term-ask-ai-btn').addEventListener('click', (e) => {
      const err = e.currentTarget.dataset.error || errorMsg;
      const chatInput = document.getElementById('chat-input');
      if (chatInput) {
        chatInput.value = `/fix ${err.slice(0, 200)}`;
        chatInput.dispatchEvent(new Event('input'));
      }
      switchTab('chat');
      document.getElementById('chat-input')?.focus();
    });

    els.termOutput.appendChild(card);
    els.termOutput.scrollTop = els.termOutput.scrollHeight;
  }

  function clearTerminal() {
    if (!els.termOutput) return;
    els.termOutput.innerHTML = `
      <div class="term-empty" id="term-empty">
        <svg class="term-empty-icon" viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M6 7l3 3-3 3"/>
        </svg>
        <div class="term-empty-text">Terminal cleared</div>
        <div class="term-empty-hint">Type a command or click a quick-launch button</div>
      </div>`;
  }

  function escapeTermText(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(str) {
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;').slice(0, 300);
  }

  /* ══════ HELPERS ══════ */
  function setHealView(mode) {
    if (els.healIdle)    els.healIdle.style.display    = mode === 'idle'     ? 'flex' : 'none';
    if (els.healSpinner) els.healSpinner.style.display = mode === 'spinning' ? 'flex' : 'none';
    if (els.healContent) els.healContent.style.display = mode === 'result'   ? 'flex' : 'none';
  }

  const STEP_MAP = {
    pending: { icon: '○', label: 'Pending' },
    running: { icon: '<div class="spinner"></div>', label: 'Running…' },
    pass:    { icon: '✓', label: 'Passed'  },
    fail:    { icon: '✕', label: 'Failed'  },
    healing: { icon: '✦', label: 'Healing…'},
    healed:  { icon: '✦', label: 'Healed'  },
  };

  function renderStepCard(index) {
    const s = state.steps[index];
    if (!s) return;
    const existing = document.querySelector(`[data-step-index="${index}"]`);
    const card = existing || document.createElement('div');
    const { icon, label } = STEP_MAP[s.state] || STEP_MAP.pending;
    card.className = `step-card state-${s.state}`;
    card.dataset.stepIndex = index;
    card.innerHTML = `
      <div class="step-icon">${icon}</div>
      <div class="step-info">
        <div class="step-index">Step ${index + 1}</div>
        <div class="step-name" title="${s.name}">${s.name}</div>
        ${s.state === 'healed' ? '<div class="step-healed-flash">⚡ Healed</div>' : ''}
      </div>
      <div class="step-state-label">${label}</div>`;
    if (!existing) {
      if (els.stepEmpty) els.stepEmpty.style.display = 'none';
      els.stepList.appendChild(card);
    }
    if (s.state === 'running' || s.state === 'healing') card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function updateStepBadge() {
    const done = Object.values(state.steps).filter(s => ['pass','fail','healed'].includes(s.state)).length;
    if (els.stepBadge) els.stepBadge.textContent = `${done} / ${state.totalSteps}`;
  }

  function updateSummaryStats({ total, passed, healed, failed, interventions } = {}) {
    if (total         !== undefined && els.statTotal)  els.statTotal.textContent  = total;
    if (passed        !== undefined && els.statPassed) els.statPassed.textContent = passed;
    if (healed        !== undefined && els.statHealed) els.statHealed.textContent = healed;
    if (failed        !== undefined && els.statFailed) els.statFailed.textContent = failed;
    if (interventions !== undefined && els.statInterv) els.statInterv.textContent = interventions;
  }

  /* ── WS dot ── */
  function setWsState(wsState) {
    if (!els.wsDot) return;
    els.wsDot.classList.remove('connected', 'reconnecting');
    if (wsState === 'connected')    els.wsDot.classList.add('connected');
    if (wsState === 'reconnecting') els.wsDot.classList.add('reconnecting');
  }

  /* ══════ DASHBOARD EVENTS ══════ */
  function onRunStart(msg) {
    _runStartTime = Date.now();
    switchTab('dashboard');
    $('btn-run').style.display = 'none';
    $('btn-stop').style.display = 'flex';
    state = { totalSteps: msg.totalSteps || 0, steps: {}, completedSteps: 0, currentHealIndex: null, currentHealOldSel: null };
    if (els.stepList) {
      els.stepList.innerHTML = '';
      const e = document.createElement('div');
      e.id = 'step-empty'; e.className = 'step-empty'; e.style.display = 'none';
      els.stepList.appendChild(e);
    }
    for (let i = 0; i < state.totalSteps; i++) { state.steps[i] = { name: `Step ${i + 1}`, state: 'pending' }; renderStepCard(i); }
    updateSummaryStats({ total: state.totalSteps, passed: 0, healed: 0, failed: 0, interventions: 0 });
    if (els.stepBadge) els.stepBadge.textContent = `0 / ${state.totalSteps}`;
    setHealView('idle');
    if (els.healBadge) els.healBadge.textContent = 'Idle';
    if (els.runStatus) els.runStatus.className = 'run-status running';
    if (els.runStatusTxt) els.runStatusTxt.textContent = 'Running';
  }

  function onStepStart(msg) {
    const { index, name } = msg;
    state.steps[index] = state.steps[index] || { name, state: 'pending' };
    state.steps[index].name  = name || state.steps[index].name;
    state.steps[index].state = 'running';
    renderStepCard(index); updateStepBadge();
  }

  function onStepPass(msg) {
    const { index, healed } = msg;
    const s = state.steps[index]; if (!s) return;
    if (!healed) s.state = 'pass';
    renderStepCard(index); updateStepBadge();
    if (!healed) { const c = parseInt(els.statPassed?.textContent || '0', 10); updateSummaryStats({ passed: c + 1 }); }
  }

  function onStepFail(msg) {
    const { index, error } = msg;
    const s = state.steps[index]; if (!s) return;
    s.state = 'fail';
    const m = error && error.match(/:\s*(.+)$/);
    state.currentHealOldSel = m ? m[1].trim() : (error || '?');
    renderStepCard(index); updateStepBadge();
    const c = parseInt(els.statFailed?.textContent || '0', 10);
    updateSummaryStats({ failed: c + 1 });
  }

  function onHealStart(msg) {
    const { index } = msg;
    state.currentHealIndex = index;
    const s = state.steps[index];
    if (s) { s.state = 'healing'; renderStepCard(index); }
    setHealView('spinning');
    if (els.healBadge) els.healBadge.textContent = `Step ${index + 1}`;
    _healStartTime = Date.now();
    const tick = () => {
      if (!_healStartTime) return;
      const sec = ((Date.now() - _healStartTime) / 1000).toFixed(1);
      if (els.healTimer) els.healTimer.textContent = `${sec}s`;
      _healTimerRaf = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(_healTimerRaf);
    _healTimerRaf = requestAnimationFrame(tick);
  }

  function onHealReason(msg) {
    const { rootCause, newSelector, confidence } = msg;
    const pct = Math.round((confidence || 0) * 100);
    const isHigh = confidence >= 0.8;
    if (els.healRootCause) els.healRootCause.textContent = rootCause || '—';
    if (els.healOldSel)    els.healOldSel.textContent    = state.currentHealOldSel || '—';
    if (els.healNewSel)    els.healNewSel.textContent    = newSelector || '—';
    if (els.confNumber) { els.confNumber.textContent = `${pct}%`; els.confNumber.className = `conf-number ${isHigh ? 'high' : 'low'}`; }
    if (els.confBar)    { els.confBar.style.width = `${pct}%`; els.confBar.className = `conf-bar-fill ${isHigh ? '' : 'low'}`; }
    if (els.confLabel)  { els.confLabel.textContent = isHigh ? '✓ High confidence — auto-applying' : '⚠ Low confidence — review recommended'; els.confLabel.className = `conf-label ${isHigh ? 'high' : 'low'}`; }
    setHealView('result');
  }

  function onHealDone(msg) {
    const { index, healed } = msg;
    cancelAnimationFrame(_healTimerRaf); _healStartTime = null;
    if (healed) {
      const s = state.steps[index]; if (s) { s.state = 'healed'; renderStepCard(index); }
      const hC = parseInt(els.statHealed?.textContent || '0', 10); updateSummaryStats({ healed: hC + 1 });
      const fC = parseInt(els.statFailed?.textContent  || '0', 10); if (fC > 0) updateSummaryStats({ failed: fC - 1 });
      if (els.healBadge) els.healBadge.textContent = 'Healed ✦';
    } else {
      if (els.healBadge) els.healBadge.textContent = 'Failed to heal';
    }
  }

  function onRunDone(msg) {
    const { passed, healed, failed, interventions } = msg;
    $('btn-run').style.display = 'flex'; $('btn-stop').style.display = 'none';
    updateSummaryStats({
      total: state.totalSteps,
      passed:        passed        ?? parseInt(els.statPassed?.textContent || '0', 10),
      healed:        healed        ?? parseInt(els.statHealed?.textContent || '0', 10),
      failed:        failed        ?? parseInt(els.statFailed?.textContent || '0', 10),
      interventions: interventions ?? 0,
    });
    const allOk = (failed === 0 || failed === undefined);
    if (els.runStatus)    els.runStatus.className = 'run-status done';
    if (els.runStatusTxt) els.runStatusTxt.textContent = allOk ? '✓ Run Complete' : '✕ Run Complete (failures)';
    if (!allOk && els.runStatus) els.runStatus.style.color = 'var(--red)';
    if (els.stepBadge) els.stepBadge.textContent = `${state.totalSteps} / ${state.totalSteps}`;
    const totalSec = _runStartTime ? ((Date.now() - _runStartTime) / 1000).toFixed(1) + 's' : '—';
    const h = healed ?? parseInt(els.statHealed?.textContent || '0', 10);
    const iv = interventions ?? 0;
    if (els.ovTotal)  els.ovTotal.textContent  = state.totalSteps;
    if (els.ovHealed) els.ovHealed.textContent = h;
    if (els.ovInterv) els.ovInterv.textContent = iv;
    if (els.ovTime)   els.ovTime.textContent   = totalSec;
    if (els.ovIcon)   els.ovIcon.textContent   = allOk ? '✦' : '✕';
    if (els.runOverlay) els.runOverlay.classList.add('show');
  }

  /* ══════ TERMINAL MESSAGE HANDLERS ══════ */
  function onTerminalOutput(msg) {
    const { line, stream } = msg;
    if (!line) return;
    const type = stream === 'stderr' ? 'stderr' : 'stdout';
    appendTermLine(line, type);

    // Heuristic error detection — show error card for fatal patterns
    if (stream === 'stderr' && (
      line.includes('Error:') || line.includes('ENOENT') ||
      line.includes('Cannot find') || line.includes('Uncaught') ||
      line.includes('TimeoutError') || line.includes('failed to')
    )) {
      showTerminalError(line);
    }
  }

  function onTerminalDone(msg) {
    const { code } = msg;
    setTerminalBusy(false);
    if (code === 0) {
      appendTermLine(`Process exited successfully (code 0)`, 'success');
    } else if (code !== null && code !== undefined) {
      appendTermLine(`Process exited with code ${code}`, 'stderr');
    } else {
      appendTermLine('Process ended', 'system');
    }
  }

  function onTerminalError(msg) {
    setTerminalBusy(false);
    appendTermLine(msg.message || 'Unknown error', 'stderr');
    showTerminalError(msg.message || 'An error occurred');
  }

  /* ── Public API ── */
  return {
    initTabs, switchTab, setWsState,
    onRunStart, onStepStart, onStepPass, onStepFail,
    onHealStart, onHealReason, onHealDone, onRunDone,
    appendTermLine, setTerminalBusy, showTerminalError, clearTerminal,
    onTerminalOutput, onTerminalDone, onTerminalError,
    onFragilityScan: (msg) => {
      const results = msg.results || [];
      if (!results.length) return;
      if (els.fragilityPanel) els.fragilityPanel.style.display = 'block';
      if (els.fragilityList) {
        els.fragilityList.innerHTML = results.map(r => `
          <div class="fragility-row">
            <div class="frag-sel" style="font-size:0.73rem;font-family:var(--font-mono);color:var(--text);word-break:break-all;">${r.selector}</div>
            <div class="frag-bar-wrap" style="height:6px;background:rgba(255,255,255,0.06);border-radius:999px;overflow:hidden;">
              <div class="frag-bar-fill risk-${r.risk}" style="width:${Math.round(r.score*100)}%;height:100%;background:${r.risk==='high'?'var(--red)':r.risk==='medium'?'var(--amber)':'var(--green)'};border-radius:999px;"></div>
            </div>
            <div class="risk-badge risk-${r.risk}">${r.risk}</div>
          </div>`).join('');
      }
    }
  };
})();

window.addEventListener('DOMContentLoaded', () => {
  UI.initTabs();

  // Dashboard buttons
  const btnRun = document.getElementById('btn-run');
  const btnStop = document.getElementById('btn-stop');
  if (btnRun)  btnRun.addEventListener('click', () => vscode.postMessage({ type: 'runTest' }));
  if (btnStop) btnStop.addEventListener('click', () => vscode.postMessage({ type: 'stopTest' }));
});
