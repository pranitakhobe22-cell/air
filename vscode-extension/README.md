# SelfHeal – VS Code Extension

> AI-Powered Test Self-Healing for Playwright

## Features

- **🩹 One-Click Healing** — Press `Cmd+Shift+H` (Mac) / `Ctrl+Shift+H` (Win/Linux) to run the currently open test file through the SelfHeal engine.
- **📊 Instant Dashboard** — Automatically launches the Web-Healer dashboard showing heal history, fragility scores, and AI-generated fixes.
- **⚡ Status Bar Integration** — A persistent `$(beaker) SelfHeal` button in your status bar for one-click access.
- **🖥️ Dedicated Terminal** — Runs in a named "SelfHeal Runner" terminal so your other terminals stay clean.
- **📝 Output Channel** — All SelfHeal activity is logged to the "SelfHeal" output channel for debugging.

## Commands

| Command | Keybinding | Description |
|---------|-----------|-------------|
| `SelfHeal: Run Current Test` | `Cmd+Shift+H` | Runs the active test file through the self-healing engine |
| `SelfHeal: Open Dashboard` | — | Opens the SelfHeal dashboard in your browser |

## Getting Started

1. Open the `vscode-extension` folder in VS Code
2. Run `npm install` in the terminal
3. Press **F5** to launch the Extension Development Host
4. Open any `.spec.js` or `.spec.ts` test file
5. Press `Cmd+Shift+H` or use the Command Palette → "SelfHeal: Run Current Test"

## Requirements

- Node.js ≥ 18
- The `selfheal` CLI must be available (install from the parent project: `npm link` in the root)
- Playwright installed in your project

## How It Works

```
You open a test file ──► Press Cmd+Shift+H
                              │
                    ┌─────────▼──────────┐
                    │  VS Code Extension  │
                    │  saves file, opens  │
                    │  terminal, runs CLI │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │   SelfHeal Engine   │
                    │  Runs Playwright    │
                    │  Detects failures   │
                    │  AI generates fix   │
                    │  Patches source     │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │   Dashboard opens   │
                    │  Shows heal report  │
                    └────────────────────┘
```
