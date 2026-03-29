<<<<<<< HEAD
# Live Aeris


=======
# SelfHeal

## What it does
SelfHeal is an AI-powered Playwright test automation layer that detects broken selectors during a test run and dynamically fixes them in real-time. It uses an intent-aware Gemini reasoning engine to understand the human goal of each step, bypassing brittle UI changes and ensuring test pipelines never fail due to structural DOM updates.

## How to run the demo
```bash
npm install
npx playwright install chromium
npx selfheal run tests/checkout.spec.js --dashboard --report
```

<<<<<<< HEAD
## 🛠️ Key Features

1. **Intent-Aware SDK**: Pass human meaning to actions to guarantee high-confidence healing.
2. **Fragility Scorer**: Pre-test analysis of your CSS/XPath selectors to identify high-risk code before execution.
3. **Live Dashboard**: Real-time Socket.IO monitoring of test steps, failures, and AI logic chains.
4. **Persistent History**: SQLite backend ensures that once healed, a selector stays healed forever.
5. **Zero-Touch Patching**: AST-based code rewriter that updates your `.spec.js` files automatically.

## 🏁 How to Run

1. **Install Dependencies**
   ```bash
   npm install
   npx playwright install chromium
   ```

2. **Set API Key**
   Create a `.env` file with:
   ```env
   GEMINI_API_KEY=your_key_here
   ```

3. **Execute the Demo**
   ```bash
   npx selfheal run tests/checkout.spec.js --dashboard
   ```

## 📂 Project Structure

- `src/healEngine/`: The brain. Contains `healAgent` (Gemini), `selectorEngine` (Fuzzy), and `failureWatcher`.
- `src/sdk/`: Explicit `healClick`, `healFill` wrappers for Devs.
- `src/intent/`: The Phase 4 **Fragility Scorer**.
- `src/storage/`: SQLite caching and JSON reporting.
- `dashboard/`: Premium Live Status interface.

## 👁️ What you will see
When you start the command, the dashboard will immediately display a pre-run fragility scan highlighting our intentionally weak, old selectors. As Playwright executes the script and elements inevitably fail to be found, you will see the self-healing engine activate live in the right panel, analyzing the DOM snapshot against the developer's intent string. It will confidently determine the new selector, log its reasoning, and seamlessly patch the test continuing the execution until completion, finally producing a comprehensive `heal-report.json` zero-human-intervention artifact.

---
*Built for the 2026 AI Agentic Coding Hackathon.*
=======
## What you will see
When you start the command, the dashboard will immediately display a pre-run fragility scan highlighting our intentionally weak, old selectors. As Playwright executes the script and elements inevitably fail to be found, you will see the self-healing engine activate live in the right panel, analyzing the DOM snapshot against the developer's intent string. It will confidently determine the new selector, log its reasoning, and seamlessly patch the test continuing the execution until completion, finally producing a comprehensive `heal-report.json` zero-human-intervention artifact.
>>>>>>> origin/phase-4
>>>>>>> a7c3a067a1d2b6ba47f52ef435296e17ae97b26a
