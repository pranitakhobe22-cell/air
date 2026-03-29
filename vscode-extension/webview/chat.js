/* ── VS Code API ── */
const vscode = (typeof acquireVsCodeApi === 'function') ? acquireVsCodeApi() : {
  postMessage: (msg) => console.log('VSCode PostMessage:', msg)
};

const Chat = (() => {

  const messagesEl  = document.getElementById('chat-messages');
  const welcomeCmds = document.getElementById('welcome-commands');
  const inputEl     = document.getElementById('chat-input');
  const sendBtn     = document.getElementById('send-btn');
  const dropdownEl  = document.getElementById('cmd-dropdown');

  let commands = [
    { name: 'debug',    description: 'Deep-dive into test failures' },
    { name: 'heal',     description: 'Auto-fix broken selectors' },
    { name: 'fix',      description: 'Generate a fix for the error' },
    { name: 'explain',  description: 'Understand complex code blocks' },
    { name: 'analyze',  description: 'Identify fragility patterns' },
    { name: 'run',      description: 'Run current test file' },
    { name: 'scan',     description: 'Fragility scan of current file' },
    { name: 'generate', description: 'Generate new test code' },
    { name: 'refactor', description: 'Refactor and clean up code' },
    { name: 'clear',    description: 'Clear chat history' },
  ];

  let selectedIdx    = -1;
  let isStreaming    = false;
  let streamingMsgId = null;

  /* ── Avatar SVGs ── */
  const GEMINI_AVATAR = `<svg viewBox="0 0 24 24" width="14" height="14" fill="white">
    <path d="M12 2l1.35 3.27L17 6.5l-3.27 1.35L12 11.25l-1.35-3.4L7 6.5l3.27-1.23L12 2z"/>
    <path d="M19 15l.75 1.81L21.5 17.5l-1.81.75L19 20l-.75-1.75L16.5 17.5l1.75-.69L19 15z" opacity="0.7"/>
  </svg>`;

  const USER_AVATAR = `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
    <path d="M13 13v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1"/><circle cx="8" cy="5" r="3"/>
  </svg>`;

  /* ── Icon Mapping (SVG) ─────────────────────────────────── */

  const svgIcons = {
    debug:    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    heal:     '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    fix:      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
    explain:  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
    analyze:  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    generate: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    refactor: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    clear:    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    run:      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
    scan:     '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>',
    default:  '<svg class="gemini-spark" viewBox="0 0 24 24" width="14" height="14" xmlns="http://www.w3.org/2000/svg"><path d="M11.666 1.805a.75.75 0 01.668 0l1.109.529c1.658.791 2.923 2.056 3.714 3.714l.529 1.109a.75.75 0 010 .668l-.529 1.109c-.791 1.658-2.056 2.923-3.714 3.714l-1.109.529a.75.75 0 01-.668 0l-1.109-.529c-1.658-.791-2.923-2.056-3.714-3.714l-.529-1.109a.75.75 0 010-.668l.529-1.109c.791-1.658 2.056-2.923 3.714-3.714l1.109-.529z" fill="url(#gemini-gradient)"/></svg>'
  };

  function getIconForCommand(cmd) {
    return svgIcons[cmd.toLowerCase()] || svgIcons.default;
  }

  /* ── Init ── */
  function init() {
    vscode.postMessage({ type: 'getCommands' });
    vscode.postMessage({ type: 'requestHistory' });
    inputEl.addEventListener('input', onInputChange);
    inputEl.addEventListener('input', autoResize);
    inputEl.addEventListener('keydown', onInputKeydown);
    sendBtn.addEventListener('click', sendMessage);
    renderWelcome();
  }

  function autoResize() {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 100) + 'px';
  }

  /* ── Send ── */
  function sendMessage() {
    const text = inputEl.value.trim();
    if (!text || isStreaming) return;
    inputEl.value = '';
    inputEl.style.height = 'auto';
    hideDropdown();
    vscode.postMessage({ type: 'chatMessage', text });
  }

  /* ── Input ── */
  function onInputChange() {
    const val = inputEl.value;
    if (val.startsWith('/') && !val.includes(' ')) {
      const partial = val.slice(1).toLowerCase();
      showDropdown(commands.filter(c => c.name.startsWith(partial)));
    } else {
      hideDropdown();
    }
  }

  function onInputKeydown(e) {
    if (dropdownEl.classList.contains('show')) {
      const opts = dropdownEl.querySelectorAll('.cmd-option');
      if (e.key === 'ArrowDown') { e.preventDefault(); selectedIdx = Math.min(selectedIdx + 1, opts.length - 1); updateDropdownSel(opts); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); selectedIdx = Math.max(selectedIdx - 1, 0); updateDropdownSel(opts); return; }
      if ((e.key === 'Tab' || e.key === 'Enter') && selectedIdx >= 0) {
        e.preventDefault();
        const cmd = opts[selectedIdx]?.dataset.cmd;
        if (cmd) { inputEl.value = `/${cmd} `; hideDropdown(); }
        return;
      }
      if (e.key === 'Escape') { hideDropdown(); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  /* ── Dropdown ── */
  function showDropdown(matches) {
    if (!matches.length) { hideDropdown(); return; }
    selectedIdx = 0;
    dropdownEl.innerHTML = matches.map((c, i) => `
      <div class="cmd-option ${i === 0 ? 'selected' : ''}" data-cmd="${c.name}">
        <span class="cmd-option-icon">${getIconForCommand(c.name)}</span>
        <span class="cmd-option-name">/${c.name}</span>
        <span class="cmd-option-desc">${c.description}</span>
      </div>
    `).join('');
    dropdownEl.querySelectorAll('.cmd-option').forEach(opt => {
      opt.addEventListener('click', () => { inputEl.value = `/${opt.dataset.cmd} `; hideDropdown(); inputEl.focus(); });
    });
    dropdownEl.classList.add('show');
  }

  function hideDropdown() { dropdownEl.classList.remove('show'); selectedIdx = -1; }
  function updateDropdownSel(opts) { opts.forEach((o, i) => o.classList.toggle('selected', i === selectedIdx)); }

  /* ── Welcome ── */
  function renderWelcome() {
    if (!welcomeCmds) return;
    const show = ['debug', 'heal', 'fix', 'explain', 'run', 'scan'];
    welcomeCmds.innerHTML = commands.filter(c => show.includes(c.name)).map(c => `
      <button class="welcome-cmd" data-cmd="${c.name}">
        <span class="welcome-cmd-icon">${getIconForCommand(c.name)}</span>
        /${c.name}
      </button>
    `).join('');
    welcomeCmds.querySelectorAll('.welcome-cmd').forEach(btn => {
      btn.addEventListener('click', () => { inputEl.value = `/${btn.dataset.cmd} `; inputEl.focus(); });
    });
  }

  /* ── Messages ── */
  function addUserMessage(content, command) {
    hideWelcome();
    const el = document.createElement('div');
    el.className = 'msg user';
    el.innerHTML = `
      <div class="msg-avatar">${USER_AVATAR}</div>
      <div class="msg-body">
        <div class="msg-header">
          <span class="msg-role">You</span>
          ${command ? `<span class="msg-cmd-badge">/${command}</span>` : ''}
        </div>
        <div class="msg-content">${escapeHtml(content)}</div>
      </div>`;
    messagesEl.appendChild(el);
    scrollBottom();
  }

  function startAssistantResponse(msgId, command) {
    hideWelcome();
    isStreaming = true; streamingMsgId = msgId; sendBtn.disabled = true;
    const el = document.createElement('div');
    el.className = 'msg assistant';
    el.id = `msg-${msgId}`;
    el.innerHTML = `
      <div class="msg-avatar">${GEMINI_AVATAR}</div>
      <div class="msg-body">
        <div class="msg-header">
          <span class="msg-role">SelfHeal AI</span>
          ${command ? `<span class="msg-cmd-badge">/${command}</span>` : ''}
        </div>
        <div class="msg-content streaming-cursor" id="content-${msgId}"></div>
      </div>`;
    messagesEl.appendChild(el);
    const typingEl = document.createElement('div');
    typingEl.className = 'typing-indicator';
    typingEl.id = `typing-${msgId}`;
    typingEl.innerHTML = `
      <svg class="gemini-spark" viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2l1.68 4.06C15.37 10.13 17.87 12.63 21.94 14.32L26 16l-4.06 1.68C17.87 19.37 15.37 21.87 13.68 25.94L12 30l-1.68-4.06C8.63 21.87 6.13 19.37 2.06 17.68L-2 16l4.06-1.68C6.13 12.63 8.63 10.13 10.32 6.06L12 2z" fill="url(#gemini-gradient)"/>
      </svg>
      <span class="gemini-text">Synthesizing…</span>`;
    messagesEl.appendChild(typingEl);
    scrollBottom();
  }

  function appendStreamChunk(msgId, chunk) {
    const t = document.getElementById(`typing-${msgId}`);
    if (t) t.remove();
    const c = document.getElementById(`content-${msgId}`);
    if (!c) return;
    if (!c._rawMd) c._rawMd = '';
    c._rawMd += chunk;
    c.innerHTML = renderMarkdown(c._rawMd);
    scrollBottom();
  }

  function finishStream(msgId) {
    isStreaming = false; streamingMsgId = null; sendBtn.disabled = false;
    const t = document.getElementById(`typing-${msgId}`);
    if (t) t.remove();
    const c = document.getElementById(`content-${msgId}`);
    if (c) {
      c.classList.remove('streaming-cursor');
      if (c._rawMd) c.innerHTML = renderMarkdown(c._rawMd);
      c.querySelectorAll('pre').forEach(addCopyButton);
    }
    scrollBottom();
  }

  function addSystemMessage(content, msgId) {
    hideWelcome();
    const el = document.createElement('div');
    el.className = 'msg assistant';
    if (msgId) el.id = `msg-${msgId}`;
    el.innerHTML = `
      <div class="msg-avatar">${GEMINI_AVATAR}</div>
      <div class="msg-body">
        <div class="msg-header"><span class="msg-role">SelfHeal AI</span></div>
        <div class="msg-content">${renderMarkdown(content)}</div>
      </div>`;
    messagesEl.appendChild(el);
    el.querySelectorAll('pre').forEach(addCopyButton);
    scrollBottom();
  }

  function clearChat() {
    messagesEl.innerHTML = `
      <div class="chat-welcome" id="chat-welcome">
        <div class="welcome-spark">
          <svg class="gemini-spark" viewBox="0 0 48 48" width="48" height="48" xmlns="http://www.w3.org/2000/svg">
            <path d="M24 4l2.7 6.54C29.6 17.13 32.87 20.4 39.46 23.3L46 24l-6.54 2.7c-6.59 2.9-9.86 6.17-12.76 12.76L24 46l-2.7-6.54C18.4 32.87 15.13 29.6 8.54 26.7L2 24l6.54-2.7C15.13 18.4 18.4 15.13 21.3 8.54L24 4z" fill="url(#gemini-gradient)"/>
          </svg>
        </div>
        <div class="welcome-title">SelfHeal AI</div>
        <div class="welcome-sub">Your AI debugging partner</div>
        <div class="welcome-commands" id="welcome-commands"></div>
      </div>`;
    renderWelcome();
  }

  /* ── Markdown renderer ── */
  function renderMarkdown(md) {
    if (!md) return '';
    let h = escapeHtml(md);
    h = h.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre><div class="code-block-header"><span>${lang || 'code'}</span></div><code>${code.trim()}</code></pre>`);
    h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
    h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/\*(.+?)\*/g, '<em>$1</em>');
    h = h.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    h = h.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    h = h.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    h = h.replace(/^- (.+)$/gm, '<li>$1</li>');
    h = h.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
    h = h.replace(/\n\n/g, '</p><p>');
    h = '<p>' + h + '</p>';
    h = h.replace(/<p>\s*<\/p>/g, '');
    h = h.replace(/<p>\s*(<[hup])/g, '$1');
    h = h.replace(/(<\/(?:h[123]|ul|pre)>)\s*<\/p>/g, '$1');
    h = h.replace(/\n/g, '<br>');
    return h;
  }

  function escapeHtml(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

  function addCopyButton(preEl) {
    const header = preEl.querySelector('.code-block-header');
    if (!header || header.querySelector('.copy-btn')) return;
    const btn = document.createElement('button');
    btn.className = 'copy-btn'; btn.textContent = 'Copy';
    btn.addEventListener('click', () => {
      const code = preEl.querySelector('code')?.textContent || '';
      navigator.clipboard?.writeText(code).then(() => { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Copy'; }, 1500); });
    });
    header.appendChild(btn);
  }

  function scrollBottom() { requestAnimationFrame(() => { messagesEl.scrollTop = messagesEl.scrollHeight; }); }
  function hideWelcome() { const w = document.getElementById('chat-welcome'); if (w) w.style.display = 'none'; }

  /* ── Message handler ── */
  function handleMessage(msg) {
    switch (msg.type) {
      case 'commandList':   commands = msg.commands || []; renderWelcome(); break;
      case 'chatHistory':   (msg.messages || []).forEach(m => m.role === 'user' ? addUserMessage(m.content, m.command) : addSystemMessage(m.content, m.id)); break;
      case 'userMessage':   addUserMessage(msg.content, msg.command); break;
      case 'chatResponseStart': startAssistantResponse(msg.msgId, msg.command); break;
      case 'chatResponse':
        if (msg.done) { if (msg.chunk) appendStreamChunk(msg.msgId, msg.chunk); finishStream(msg.msgId); }
        else { appendStreamChunk(msg.msgId, msg.chunk); }
        break;
      case 'clearChat': clearChat(); break;
    }
  }

  /* ── Prefill input (used by Terminal "Ask AI to Fix") ───── */
  function prefillInput(text) {
    if (inputEl) {
      inputEl.value = text;
      inputEl.focus();
      autoResize();
    }
  }

  /* ── Public API ──────────────────────────────────────────── */
  return {
    init,
    handleMessage,
    prefillInput,
  };
})();

window.addEventListener('DOMContentLoaded', () => { Chat.init(); });
