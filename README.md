# SelfHeal 🩺
### AI-Powered Test Self-Healing with Intent Matching

SelfHeal is a high-performance Playwright wrapper that intercepts test failures, analyzes them using **Gemini 2.5 Flash**, and automatically patches your source code with working selectors.

---


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

---
*Built for the 2026 AI Agentic Coding Hackathon by Dev 1 & Dev 2.*
