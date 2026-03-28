/* ================================================================
   ui.js
   Dashboard DOM manipulation + Tab system.
   Called by ws-client.js on every WebSocket event.
   ================================================================ */

const UI = (() => {

  /* ── Element refs ───────────────────────────────────────── */
  const $ = id => document.getElementById(id);

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
  };

  /* ── Internal state ─────────────────────────────────────── */
  let state = {
    totalSteps: 0,
    steps: {},
    completedSteps: 0,
    currentHealIndex: null,
    currentHealOldSel: null,
  };

  let _runStartTime   = null;
  let _healStartTime  = null;
  let _healTimerRaf   = null;

  /* ── Tab System ─────────────────────────────────────────── */

  function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        switchTab(btn.dataset.tab);
      });
    });
  }

  function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `tab-${tabName}`);
    });
  }

  /* ── Helpers ────────────────────────────────────────────── */

  function setHealView(mode) {
    if (els.healIdle)    els.healIdle.style.display    = mode === 'idle'    ? 'flex' : 'none';
    if (els.healSpinner) els.healSpinner.style.display = mode === 'spinning'? 'flex' : 'none';
    if (els.healContent) els.healContent.style.display = mode === 'result'  ? 'flex' : 'none';
  }

  function renderStepCard(index) {
    const s = state.steps[index];
    if (!s) return;

    const existing = document.querySelector(`[data-step-index="${index}"]`);
    const card = existing || document.createElement('div');

    const stateMap = {
      pending: { icon: '○', label: 'Pending' },
      running: { icon: '<div class="spinner"></div>', label: 'Running…' },
      pass:    { icon: '✓', label: 'Passed'  },
      fail:    { icon: '✕', label: 'Failed'  },
      healing: { icon: '✦', label: 'Healing…'},
      healed:  { icon: '✦', label: 'Healed'  },
    };

    const { icon, label } = stateMap[s.state] || stateMap.pending;

    card.className   = `step-card state-${s.state}`;
    card.dataset.stepIndex = index;
    card.innerHTML = `
      <div class="step-icon">${icon}</div>
      <div class="step-info">
        <div class="step-index">Step ${index + 1}</div>
        <div class="step-name" title="${s.name}">${s.name}</div>
        ${s.state === 'healed' ? '<div class="step-healed-flash">⚡ Healed</div>' : ''}
      </div>
      <div class="step-state-label">${label}</div>
    `;

    if (!existing) {
      if (els.stepEmpty) els.stepEmpty.style.display = 'none';
      els.stepList.appendChild(card);
    }

    if (s.state === 'running' || s.state === 'healing') {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function updateStepBadge() {
    const done = Object.values(state.steps)
      .filter(s => ['pass','fail','healed'].includes(s.state)).length;
    if (els.stepBadge) els.stepBadge.textContent = `${done} / ${state.totalSteps}`;
  }

  function updateSummaryStats({ total, passed, healed, failed, interventions } = {}) {
    if (total        !== undefined && els.statTotal)  els.statTotal.textContent  = total;
    if (passed       !== undefined && els.statPassed) els.statPassed.textContent = passed;
    if (healed       !== undefined && els.statHealed) els.statHealed.textContent = healed;
    if (failed       !== undefined && els.statFailed) els.statFailed.textContent = failed;
    if (interventions!== undefined && els.statInterv) els.statInterv.textContent = interventions;
  }

  /* ── WS connection state ────────────────────────────────── */
  function setWsState(wsState) {
    if (!els.wsDot) return;
    els.wsDot.classList.remove('connected', 'reconnecting');
    if (wsState === 'connected') els.wsDot.classList.add('connected');
    if (wsState === 'reconnecting') els.wsDot.classList.add('reconnecting');
  }

  /* ── Event handlers (Dashboard) ─────────────────────────── */

  function onRunStart(msg) {
    _runStartTime = Date.now();

    // Auto-switch to dashboard tab
    switchTab('dashboard');

    // Toggle controls
    const btnRun = document.getElementById('btn-run');
    const btnStop = document.getElementById('btn-stop');
    if (btnRun) btnRun.style.display = 'none';
    if (btnStop) btnStop.style.display = 'flex';

    state = { totalSteps: msg.totalSteps || 0, steps: {}, completedSteps: 0, currentHealIndex: null, currentHealOldSel: null };

    if (els.stepList) {
      els.stepList.innerHTML = '';
      const emptyEl = document.createElement('div');
      emptyEl.id = 'step-empty';
      emptyEl.className = 'step-empty';
      emptyEl.style.display = 'none';
      els.stepList.appendChild(emptyEl);
    }

    for (let i = 0; i < state.totalSteps; i++) {
      state.steps[i] = { name: `Step ${i + 1}`, state: 'pending' };
      renderStepCard(i);
    }

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
    renderStepCard(index);
    updateStepBadge();
  }

  function onStepPass(msg) {
    const { index, healed } = msg;
    const s = state.steps[index];
    if (!s) return;
    if (!healed) s.state = 'pass';
    renderStepCard(index);
    updateStepBadge();
    if (!healed) {
      const current = parseInt(els.statPassed?.textContent || '0', 10);
      updateSummaryStats({ passed: current + 1 });
    }
  }

  function onStepFail(msg) {
    const { index, error } = msg;
    const s = state.steps[index];
    if (!s) return;
    s.state = 'fail';
    const selectorMatch = error && error.match(/:\s*(.+)$/);
    state.currentHealOldSel = selectorMatch ? selectorMatch[1].trim() : (error || '?');
    renderStepCard(index);
    updateStepBadge();
    const current = parseInt(els.statFailed?.textContent || '0', 10);
    updateSummaryStats({ failed: current + 1 });
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
    if (els.healOldSel) els.healOldSel.textContent = state.currentHealOldSel || '—';
    if (els.healNewSel) els.healNewSel.textContent = newSelector || '—';
    if (els.confNumber) {
      els.confNumber.textContent = `${pct}%`;
      els.confNumber.className = `conf-number ${isHigh ? 'high' : 'low'}`;
    }
    if (els.confBar) {
      els.confBar.style.width = `${pct}%`;
      els.confBar.className = `conf-bar-fill ${isHigh ? '' : 'low'}`;
    }
    if (els.confLabel) {
      els.confLabel.textContent = isHigh ? '✓ High confidence — auto-applying' : '⚠ Low confidence — review recommended';
      els.confLabel.className = `conf-label ${isHigh ? 'high' : 'low'}`;
    }
    setHealView('result');
  }

  function onHealDone(msg) {
    const { index, healed } = msg;
    cancelAnimationFrame(_healTimerRaf);
    _healStartTime = null;
    if (healed) {
      const s = state.steps[index];
      if (s) { s.state = 'healed'; renderStepCard(index); }
      const hCurrent = parseInt(els.statHealed?.textContent || '0', 10);
      updateSummaryStats({ healed: hCurrent + 1 });
      const fCurrent = parseInt(els.statFailed?.textContent || '0', 10);
      if (fCurrent > 0) updateSummaryStats({ failed: fCurrent - 1 });
      if (els.healBadge) els.healBadge.textContent = `Healed ✦`;
    } else {
      if (els.healBadge) els.healBadge.textContent = 'Failed to heal';
    }
  }

  function onRunDone(msg) {
    const { passed, healed, failed, interventions } = msg;
    const btnRun = document.getElementById('btn-run');
    const btnStop = document.getElementById('btn-stop');
    if (btnRun) btnRun.style.display = 'flex';
    if (btnStop) btnStop.style.display = 'none';
    updateSummaryStats({
      total:         state.totalSteps,
      passed:        passed        ?? parseInt(els.statPassed?.textContent || '0', 10),
      healed:        healed        ?? parseInt(els.statHealed?.textContent || '0', 10),
      failed:        failed        ?? parseInt(els.statFailed?.textContent || '0', 10),
      interventions: interventions ?? 0,
    });
    const allOk = (failed === 0 || failed === undefined);
    if (els.runStatus) els.runStatus.className = `run-status done`;
    if (els.runStatusTxt) els.runStatusTxt.textContent = allOk ? '✓ Run Complete' : '✕ Run Complete (failures)';
    if (!allOk && els.runStatus) els.runStatus.style.color = 'var(--red)';
    if (els.stepBadge) els.stepBadge.textContent = `${state.totalSteps} / ${state.totalSteps}`;

    const totalSec = _runStartTime ? (((Date.now() - _runStartTime) / 1000).toFixed(1) + 's') : '—';
    const h = healed ?? parseInt(els.statHealed?.textContent || '0', 10);
    const t = state.totalSteps;
    const iv = interventions ?? 0;

    if (els.ovTotal)  els.ovTotal.textContent  = t;
    if (els.ovHealed) els.ovHealed.textContent = h;
    if (els.ovInterv) els.ovInterv.textContent = iv;
    if (els.ovTime)   els.ovTime.textContent   = totalSec;
    if (els.ovIcon)   els.ovIcon.textContent   = allOk ? '✦' : '✕';
    if (els.runOverlay) els.runOverlay.classList.add('show');
  }

  /* ── Public API ─────────────────────────────────────────── */
  return {
    initTabs,
    switchTab,
    setWsState,
    onRunStart,
    onStepStart,
    onStepPass,
    onStepFail,
    onHealStart,
    onHealReason,
    onHealDone,
    onRunDone,
    onFragilityScan: (msg) => {
      const results = msg.results || [];
      if (results.length === 0) return;
      if (els.fragilityPanel) els.fragilityPanel.style.display = 'block';
      if (els.fragilityList) {
        els.fragilityList.innerHTML = results.map(r => `
          <div class="fragility-row">
            <div class="frag-sel">${r.selector}</div>
            <div class="frag-bar-wrap">
              <div class="frag-bar-fill risk-${r.risk}" style="width: ${Math.round(r.score * 100)}%"></div>
            </div>
            <div class="risk-badge risk-${r.risk}">${r.risk}</div>
          </div>
        `).join('');
      }
    }
  };

})();
