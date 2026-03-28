# SelfHeal

## What it does
SelfHeal is an AI-powered Playwright test automation layer that detects broken selectors during a test run and dynamically fixes them in real-time. It uses an intent-aware Gemini reasoning engine to understand the human goal of each step, bypassing brittle UI changes and ensuring test pipelines never fail due to structural DOM updates.

## How to run the demo
```bash
npm install
npx playwright install chromium
npx selfheal run tests/checkout.spec.js --dashboard --report
```

## What you will see
When you start the command, the dashboard will immediately display a pre-run fragility scan highlighting our intentionally weak, old selectors. As Playwright executes the script and elements inevitably fail to be found, you will see the self-healing engine activate live in the right panel, analyzing the DOM snapshot against the developer's intent string. It will confidently determine the new selector, log its reasoning, and seamlessly patch the test continuing the execution until completion, finally producing a comprehensive `heal-report.json` zero-human-intervention artifact.
