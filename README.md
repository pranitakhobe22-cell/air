# SelfHeal 🩺
### AI-Powered Test Self-Healing with Intent Matching

SelfHeal is a high-performance Playwright wrapper that intercepts test failures, analyzes them using **Gemini 2.5 Flash**, and automatically patches your source code with working selectors.

---

## 🚀 The 30-Second Stage Pitch

"We’ve all been there: Your frontend team deploys a beautiful V2 update, but your Playwright tests instantly crash because a button ID changed or a div was wrapped. 

**SelfHeal changes that.** 

It doesn't just fail; it **heals**. Using our **Intent Layer**, you tell the SDK your *human goal* (e.g., 'Click the login button'). When the test breaks, our AI doesn't just look for string similarity—it finds the element that satisfies your goal. 

Combined with our **Fragility Scorer** which warns you about brittle selectors before you even hit 'Run', SelfHeal makes 'Flaky Test' a term of the past. One run, zero crashes, auto-patched code. That is the future of QA."

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

## 📂 Project Structure (Hackathon Blueprint)

- `src/healEngine/`: The brain. Contains `healAgent` (Gemini), `selectorEngine` (Fuzzy), and `failureWatcher`.
- `src/sdk/`: Explicit `healClick`, `healFill` wrappers for Devs.
- `src/intent/`: The Phase 4 **Fragility Scorer**.
- `src/storage/`: SQLite caching and JSON reporting.
- `dashboard/`: Premium Live Status interface.

---
*Built for the 2026 AI Agentic Coding Hackathon by Dev 1 & Dev 2.*
