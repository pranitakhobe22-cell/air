# 🩺 SelfHeal

> **AI-Powered Self-Healing Test Automation for Playwright**

SelfHeal is an intelligent Playwright test automation layer that **detects broken selectors during a test run and dynamically fixes them in real-time**. It uses an intent-aware Gemini reasoning engine to understand the *human goal* of each step, bypassing brittle UI changes and ensuring test pipelines never fail due to structural DOM updates.

---

## 🎬 Quick Start

```bash
# 1. Clone & install
git clone https://github.com/srujakwarbhuvan/SelfHeal.git
cd SelfHeal
npm install
npx playwright install chromium

# 2. Set your Gemini API key
echo "GEMINI_API_KEY=your_key_here" > .env

# 3. Run the demo
npx selfheal run tests/checkout.spec.js --dashboard
```

The dashboard opens automatically — watch the self-healing engine fix 6 intentionally broken selectors in real time.

---

## 🛠️ Key Features

| Feature | Description |
|---------|-------------|
| **🧬 Intent-Aware SDK** | Pass human-readable intent strings to `healClick`, `healFill`, `healNavigate` — the AI uses your description to find the right element even when selectors break |
| **📊 Fragility Scorer** | Pre-test static analysis of CSS/XPath selectors to identify high-risk, brittle code *before* execution |
| **📡 Live Dashboard** | Real-time Socket.IO dashboard showing test progress, failures, AI reasoning chains, and heal history |
| **🧠 Gemini AI Agent** | Sends DOM snapshots + developer intent to Google's Gemini model — gets back confident, working selectors |
| **💾 Persistent History** | SQLite backend caches healed selectors — once healed, a selector stays healed forever (zero API calls on reruns) |
| **✏️ Zero-Touch Patching** | AST-based source code rewriter updates your `.spec.js` files automatically with the healed selectors |
| **⚡ VS Code Extension** | One-click `Cmd+Shift+H` to run the current test file through the healing engine from your editor |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    VS Code Extension                        │
│              Cmd+Shift+H → CLI Runner                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                     CLI Runner                               │
│  bin/selfheal.js → bin/cliRunner.js                         │
│  Launches Playwright, starts dashboard, orchestrates run    │
└──────────┬───────────────┬──────────────┬───────────────────┘
           │               │              │
  ┌────────▼────────┐ ┌────▼────────┐ ┌───▼──────────────┐
  │   SDK Wrappers  │ │  Dashboard  │ │  Fragility       │
  │  healClick()    │ │  Express +  │ │  Scorer          │
  │  healFill()     │ │  Socket.IO  │ │  Pre-run static  │
  │  healNavigate() │ │  Live UI    │ │  analysis        │
  └────────┬────────┘ └─────────────┘ └──────────────────┘
           │
  ┌────────▼─────────────────────────────────────────────┐
  │               Heal Engine Pipeline                    │
  │                                                       │
  │  1. failureWatcher — detects selector failures        │
  │  2. selectorEngine — fuzzy DOM matching (fast path)   │
  │  3. healAgent → Gemini AI (smart path)                │
  │  4. healHistory — SQLite cache lookup/save            │
  │  5. patchWriter — AST rewrite of source files         │
  └──────────────────────────────────────────────────────┘
```

---

## 📂 Project Structure

```
SelfHeal/
├── bin/                    # CLI entry point
│   ├── selfheal.js         # npx selfheal command
│   └── cliRunner.js        # Orchestrator (servers, browser, test)
├── src/
│   ├── sdk/                # Developer-facing wrappers
│   │   ├── healClick.js    # Self-healing page.click()
│   │   ├── healFill.js     # Self-healing page.fill()
│   │   └── healNavigate.js # Self-healing page.goto()
│   ├── healEngine/         # Core healing logic
│   │   ├── healAgent.js    # Gemini AI integration
│   │   ├── selectorEngine.js # Fuzzy DOM matching
│   │   └── failureWatcher.js # Failure detection
│   ├── intent/             # Phase 4 — Intent layer
│   │   └── fragilityScorer.js # Static selector risk analysis
│   ├── patcher/            # AST-based source code patching
│   ├── storage/            # SQLite database layer
│   ├── server/             # Express + WebSocket servers
│   └── reporter/           # JSON report generator
├── dashboard/              # Real-time web UI
│   ├── index.html          # Premium dark-mode dashboard
│   ├── ui.js               # UI rendering logic
│   └── ws-client.js        # WebSocket client
├── tests/                  # Demo test with broken selectors
│   └── checkout.spec.js    # 6-step ShopFlow checkout demo
├── vscode-extension/       # VS Code integration
│   ├── src/extension.ts    # Extension source
│   ├── package.json        # Extension manifest
│   └── images/icon.png     # Extension icon
└── selfheal.config.js      # Configuration
```

---

## 👁️ What You'll See

When you start the command:

1. **Pre-Run Fragility Scan** — The dashboard highlights intentionally weak selectors with risk scores
2. **Live Self-Healing** — As Playwright executes and elements fail, watch the healing engine activate in real time
3. **AI Reasoning** — See Gemini analyze DOM snapshots against developer intent strings
4. **Auto-Patching** — Source code is rewritten with corrected selectors
5. **Heal Report** — A comprehensive `heal-report.json` artifact is generated — zero human intervention

---

## ⚡ VS Code Extension

Install the extension for a seamless developer experience:

```bash
cd vscode-extension
npm install && npm run compile
# Press F5 in VS Code to launch Extension Development Host
```

| Shortcut | Command |
|----------|---------|
| `Cmd+Shift+H` | Run current test through SelfHeal |
| Command Palette | "SelfHeal: Open Dashboard" |

---

## 🔧 Configuration

Create a `.env` file in the project root:

```env
GEMINI_API_KEY=your_gemini_api_key
```

---

## 📦 CLI Usage

```bash
# Run a test with self-healing + live dashboard
npx selfheal run <test-file> --dashboard

# Run without dashboard (CI mode)
npx selfheal run <test-file>
```

---

## 🧪 Tech Stack

- **Runtime**: Node.js ≥ 18
- **Test Framework**: Playwright
- **AI**: Google Gemini (via `@google/genai`)
- **Database**: SQLite (via `better-sqlite3`)
- **Dashboard**: Express + Socket.IO + vanilla JS
- **Code Patching**: Recast (AST manipulation)
- **VS Code Extension**: TypeScript

---

*Built for the 2026 AI Agentic Coding Hackathon.*
