/* ================================================================
   chat.js
   Chat system for the SelfHeal AI Dev Assistant.
   Handles message rendering, markdown parsing, command autocomplete,
   and streaming response display inside the VS Code webview sidebar.
   ================================================================ */

const Chat = (() => {

  /* ── Element refs ────────────────────────────────────────── */
  const messagesEl    = document.getElementById('chat-messages');
  const welcomeEl     = document.getElementById('chat-welcome');
  const welcomeCmds   = document.getElementById('welcome-commands');
  const inputEl       = document.getElementById('chat-input');
  const sendBtn       = document.getElementById('send-btn');
  const dropdownEl    = document.getElementById('cmd-dropdown');

  let commands = [];      // populated from extension host
  let selectedIdx = -1;   // dropdown selection index
  let isStreaming = false; // prevent double-send during streaming
  let streamingMsgId = null;

  /* ── Initialisation ──────────────────────────────────────── */

  function init() {
    // Request command list from extension host
    vscode.postMessage({ type: 'getCommands' });
    // Request any existing chat history
    vscode.postMessage({ type: 'requestHistory' });

    // Input events
    inputEl.addEventListener('input', onInputChange);
    inputEl.addEventListener('keydown', onInputKeydown);
    sendBtn.addEventListener('click', sendMessage);

    // Auto-resize textarea
    inputEl.addEventListener('input', autoResize);
  }

  function autoResize() {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 100) + 'px';
  }

  /* ── Send message ────────────────────────────────────────── */

  function sendMessage() {
    const text = inputEl.value.trim();
    if (!text || isStreaming) return;

    inputEl.value = '';
    inputEl.style.height = 'auto';
    hideDropdown();

    // Send to extension host
    vscode.postMessage({ type: 'chatMessage', text });
  }

  /* ── Input handling ──────────────────────────────────────── */

  function onInputChange() {
    const val = inputEl.value;

    // Show command dropdown if input starts with /
    if (val.startsWith('/') && !val.includes(' ')) {
      const partial = val.slice(1).toLowerCase();
      const matches = commands.filter(c => c.name.startsWith(partial));
      showDropdown(matches);
    } else {
      hideDropdown();
    }
  }

  function onInputKeydown(e) {
    // Dropdown navigation
    if (dropdownEl.classList.contains('show')) {
      const options = dropdownEl.querySelectorAll('.cmd-option');

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIdx = Math.min(selectedIdx + 1, options.length - 1);
        updateDropdownSelection(options);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIdx = Math.max(selectedIdx - 1, 0);
        updateDropdownSelection(options);
        return;
      }
      if ((e.key === 'Tab' || e.key === 'Enter') && selectedIdx >= 0) {
        e.preventDefault();
        const cmd = options[selectedIdx]?.dataset.cmd;
        if (cmd) {
          inputEl.value = `/${cmd} `;
          hideDropdown();
        }
        return;
      }
      if (e.key === 'Escape') {
        hideDropdown();
        return;
      }
    }

    // Send on Enter (no shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  /* ── Command Dropdown ────────────────────────────────────── */

  function showDropdown(matches) {
    if (matches.length === 0) { hideDropdown(); return; }

    selectedIdx = 0;
    dropdownEl.innerHTML = matches.map((c, i) => `
      <div class="cmd-option ${i === 0 ? 'selected' : ''}" data-cmd="${c.name}">
        <span class="cmd-option-icon">${c.icon}</span>
        <span class="cmd-option-name">/${c.name}</span>
        <span class="cmd-option-desc">${c.description}</span>
      </div>
    `).join('');

    // Click handler for options
    dropdownEl.querySelectorAll('.cmd-option').forEach(opt => {
      opt.addEventListener('click', () => {
        inputEl.value = `/${opt.dataset.cmd} `;
        hideDropdown();
        inputEl.focus();
      });
    });

    dropdownEl.classList.add('show');
  }

  function hideDropdown() {
    dropdownEl.classList.remove('show');
    selectedIdx = -1;
  }

  function updateDropdownSelection(options) {
    options.forEach((opt, i) => {
      opt.classList.toggle('selected', i === selectedIdx);
    });
  }

  /* ── Welcome Screen ──────────────────────────────────────── */

  function renderWelcome() {
    if (!welcomeCmds) return;
    welcomeCmds.innerHTML = commands
      .filter(c => c.requiresCode !== false || c.name === 'clear')
      .slice(0, 6)
      .map(c => `<button class="welcome-cmd" data-cmd="${c.name}">${c.icon} /${c.name}</button>`)
      .join('');

    welcomeCmds.querySelectorAll('.welcome-cmd').forEach(btn => {
      btn.addEventListener('click', () => {
        inputEl.value = `/${btn.dataset.cmd} `;
        inputEl.focus();
      });
    });
  }

  /* ── Render Messages ─────────────────────────────────────── */

  /** Add a user message bubble. */
  function addUserMessage(content, command) {
    hideWelcome();

    const msgEl = document.createElement('div');
    msgEl.className = 'msg user';
    msgEl.innerHTML = `
      <div class="msg-avatar">👤</div>
      <div class="msg-body">
        <div class="msg-header">
          <span class="msg-role">You</span>
          ${command ? `<span class="msg-cmd-badge">/${command}</span>` : ''}
        </div>
        <div class="msg-content">${escapeHtml(content)}</div>
      </div>
    `;
    messagesEl.appendChild(msgEl);
    scrollToBottom();
  }

  /** Start a streaming assistant response. */
  function startAssistantResponse(msgId, command) {
    hideWelcome();
    isStreaming = true;
    streamingMsgId = msgId;
    sendBtn.disabled = true;

    const msgEl = document.createElement('div');
    msgEl.className = 'msg assistant';
    msgEl.id = `msg-${msgId}`;
    msgEl.innerHTML = `
      <div class="msg-avatar">🛡️</div>
      <div class="msg-body">
        <div class="msg-header">
          <span class="msg-role">SelfHeal</span>
          ${command ? `<span class="msg-cmd-badge">/${command}</span>` : ''}
        </div>
        <div class="msg-content streaming-cursor" id="content-${msgId}"></div>
      </div>
    `;
    messagesEl.appendChild(msgEl);

    // Add typing indicator
    const typingEl = document.createElement('div');
    typingEl.className = 'typing-indicator';
    typingEl.id = `typing-${msgId}`;
    typingEl.innerHTML = `
      <div class="typing-dots"><span></span><span></span><span></span></div>
      <span>Thinking…</span>
    `;
    messagesEl.appendChild(typingEl);
    scrollToBottom();
  }

  /** Append streamed text chunk. */
  function appendStreamChunk(msgId, chunk) {
    // Remove typing indicator on first chunk
    const typingEl = document.getElementById(`typing-${msgId}`);
    if (typingEl) typingEl.remove();

    const contentEl = document.getElementById(`content-${msgId}`);
    if (!contentEl) return;

    // Accumulate raw markdown, then re-render
    if (!contentEl._rawMd) contentEl._rawMd = '';
    contentEl._rawMd += chunk;
    contentEl.innerHTML = renderMarkdown(contentEl._rawMd);
    scrollToBottom();
  }

  /** Finish streaming and finalize the message. */
  function finishStream(msgId) {
    isStreaming = false;
    streamingMsgId = null;
    sendBtn.disabled = false;

    // Remove typing indicator if still present
    const typingEl = document.getElementById(`typing-${msgId}`);
    if (typingEl) typingEl.remove();

    // Remove streaming cursor
    const contentEl = document.getElementById(`content-${msgId}`);
    if (contentEl) {
      contentEl.classList.remove('streaming-cursor');
      // Final render
      if (contentEl._rawMd) {
        contentEl.innerHTML = renderMarkdown(contentEl._rawMd);
      }
      // Add copy buttons to code blocks
      contentEl.querySelectorAll('pre').forEach(addCopyButton);
    }

    scrollToBottom();
  }

  /** Add an inline error/info message (not from streaming). */
  function addSystemMessage(content, msgId) {
    hideWelcome();
    const msgEl = document.createElement('div');
    msgEl.className = 'msg assistant';
    if (msgId) msgEl.id = `msg-${msgId}`;
    msgEl.innerHTML = `
      <div class="msg-avatar">🛡️</div>
      <div class="msg-body">
        <div class="msg-header">
          <span class="msg-role">SelfHeal</span>
        </div>
        <div class="msg-content">${renderMarkdown(content)}</div>
      </div>
    `;
    messagesEl.appendChild(msgEl);
    // Add copy buttons
    msgEl.querySelectorAll('pre').forEach(addCopyButton);
    scrollToBottom();
  }

  /** Clear all chat messages and show welcome. */
  function clearChat() {
    messagesEl.innerHTML = '';
    // Re-add welcome
    const welcomeHtml = `
      <div class="chat-welcome" id="chat-welcome">
        <span class="welcome-icon">🛡️</span>
        <div class="welcome-title">SelfHeal AI Assistant</div>
        <div class="welcome-sub">Debugging intelligence for your IDE</div>
        <div class="welcome-commands" id="welcome-commands"></div>
      </div>
    `;
    messagesEl.innerHTML = welcomeHtml;
    renderWelcome();
  }

  /* ── Markdown Renderer (lightweight) ─────────────────────── */

  function renderMarkdown(md) {
    if (!md) return '';
    let html = escapeHtml(md);

    // Code blocks: ```lang\ncode\n```
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const langLabel = lang || 'code';
      return `<pre><div class="code-block-header"><span>${langLabel}</span></div><code>${code.trim()}</code></pre>`;
    });

    // Inline code: `code`
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold: **text**
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic: *text*
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Headers: ## text
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Unordered list: - item
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

    // Ordered list: 1. item
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    // Paragraphs (double newlines)
    html = html.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';

    // Clean up empty paragraphs
    html = html.replace(/<p>\s*<\/p>/g, '');
    html = html.replace(/<p>\s*(<h[123]>)/g, '$1');
    html = html.replace(/(<\/h[123]>)\s*<\/p>/g, '$1');
    html = html.replace(/<p>\s*(<ul>)/g, '$1');
    html = html.replace(/(<\/ul>)\s*<\/p>/g, '$1');
    html = html.replace(/<p>\s*(<pre>)/g, '$1');
    html = html.replace(/(<\/pre>)\s*<\/p>/g, '$1');

    // Line breaks
    html = html.replace(/\n/g, '<br>');

    return html;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ── Copy Button for Code Blocks ─────────────────────────── */

  function addCopyButton(preEl) {
    const header = preEl.querySelector('.code-block-header');
    if (!header || header.querySelector('.copy-btn')) return;

    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.textContent = 'Copy';
    btn.addEventListener('click', () => {
      const code = preEl.querySelector('code')?.textContent || '';
      navigator.clipboard.writeText(code).then(() => {
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
      });
    });
    header.appendChild(btn);
  }

  /* ── Helpers ─────────────────────────────────────────────── */

  function scrollToBottom() {
    requestAnimationFrame(() => {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  }

  function hideWelcome() {
    const w = document.getElementById('chat-welcome');
    if (w) w.style.display = 'none';
  }

  /* ── Message handler from Extension Host ─────────────────── */

  function handleMessage(msg) {
    switch (msg.type) {
      case 'commandList':
        commands = msg.commands || [];
        renderWelcome();
        break;

      case 'chatHistory':
        // Re-render full history on restore
        (msg.messages || []).forEach(m => {
          if (m.role === 'user') {
            addUserMessage(m.content, m.command);
          } else {
            addSystemMessage(m.content, m.id);
          }
        });
        break;

      case 'userMessage':
        addUserMessage(msg.content, msg.command);
        break;

      case 'chatResponseStart':
        startAssistantResponse(msg.msgId, msg.command);
        break;

      case 'chatResponse':
        if (msg.done) {
          if (msg.chunk) appendStreamChunk(msg.msgId, msg.chunk);
          finishStream(msg.msgId);
        } else {
          appendStreamChunk(msg.msgId, msg.chunk);
        }
        break;

      case 'clearChat':
        clearChat();
        break;

      case 'switchTab':
        // Handled by ui.js
        break;
    }
  }

  /* ── Public API ──────────────────────────────────────────── */
  return {
    init,
    handleMessage,
  };

})();

// Initialize when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  Chat.init();
});
