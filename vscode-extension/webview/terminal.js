/* ================================================================
   terminal.js — Terminal Tab Logic
   One-shot command execution with live streaming output.
   ================================================================ */

const Terminal = (() => {
  const $ = id => document.getElementById(id);

  const outputEl   = $('term-output');
  const inputEl    = $('term-input');
  const killBtn    = $('term-kill-btn');

  let isRunning = false;
  let commandId = 0;

  /* ── Initialisation ──────────────────────────────────────── */
  function init() {
    // Input: Enter to send
    if (inputEl) {
      inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          runCommand(inputEl.value.trim());
        }
      });
    }

    // Kill button
    if (killBtn) {
      killBtn.addEventListener('click', () => {
        vscode.postMessage({ type: 'killTerminalCommand' });
        appendLine('Process killed by user.', 'stderr');
        setRunning(false);
      });
    }

    // Quick-launch buttons
    document.querySelectorAll('.term-quick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const cmd = btn.dataset.cmd;
        if (cmd) runCommand(cmd);
      });
    });
  }

  /* ── Run a command ───────────────────────────────────────── */
  function runCommand(cmd) {
    if (!cmd || isRunning) return;

    inputEl.value = '';
    commandId++;
    setRunning(true);

    // Clear previous output
    outputEl.innerHTML = '';
    appendLine(`$ ${cmd}`, 'cmd');

    vscode.postMessage({ type: 'runTerminalCommand', command: cmd });
  }

  /* ── Append a line of output ─────────────────────────────── */
  function appendLine(text, stream = 'stdout') {
    const line = document.createElement('div');
    line.className = `term-line term-${stream}`;
    line.textContent = text;
    outputEl.appendChild(line);
    outputEl.scrollTop = outputEl.scrollHeight;

    // If stderr and looks like an error, show diagnostic card
    if (stream === 'stderr' && looksLikeError(text)) {
      showErrorCard(text);
    }
  }

  /* ── Error detection ─────────────────────────────────────── */
  function looksLikeError(text) {
    return /error|Error|ERR!|failed|FAIL|exception|Exception|TypeError|ReferenceError/i.test(text)
      && text.length > 10;
  }

  function showErrorCard(errorText) {
    const card = document.createElement('div');
    card.className = 'term-error-card';
    card.innerHTML = `
      <div class="term-error-header">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        <span>Error Detected</span>
      </div>
      <div class="term-error-body">${escapeHtml(errorText.substring(0, 200))}</div>
      <button class="term-fix-btn" data-error="${escapeAttr(errorText.substring(0, 200))}">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        Ask AI to Fix
      </button>
    `;
    card.querySelector('.term-fix-btn').addEventListener('click', (e) => {
      const err = e.currentTarget.dataset.error;
      // Switch to chat tab and prefill
      UI.switchTab('chat');
      Chat.prefillInput(`/fix ${err}`);
    });
    outputEl.appendChild(card);
    outputEl.scrollTop = outputEl.scrollHeight;
  }

  /* ── Process done ────────────────────────────────────────── */
  function onProcessDone(code) {
    setRunning(false);
    const line = document.createElement('div');
    line.className = `term-line term-${code === 0 ? 'success' : 'stderr'}`;
    line.textContent = `Process exited with code ${code}`;
    outputEl.appendChild(line);
    outputEl.scrollTop = outputEl.scrollHeight;
  }

  /* ── Helpers ─────────────────────────────────────────────── */
  function setRunning(running) {
    isRunning = running;
    if (killBtn) killBtn.style.display = running ? 'flex' : 'none';
    if (inputEl) inputEl.disabled = running;
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function escapeAttr(str) {
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ── Message handler ─────────────────────────────────────── */
  function handleMessage(msg) {
    switch (msg.type) {
      case 'terminalOutput':
        appendLine(msg.text, msg.stream || 'stdout');
        break;
      case 'terminalDone':
        onProcessDone(msg.code);
        break;
    }
  }

  return { init, handleMessage, runCommand };
})();

window.addEventListener('DOMContentLoaded', () => {
  Terminal.init();
});
