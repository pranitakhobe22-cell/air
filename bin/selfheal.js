#!/usr/bin/env node
/**
 * bin/selfheal.js
 * ============================================================
 * CLI entry point for the SelfHeal tool.
 *
 * Usage
 * ─────
 *   selfheal run <testFile> [options]
 *
 * Options
 * ─────────────────────────────────────────────────────────────
 *  --safe                 Safe mode — suggest fixes, never rewrite files
 *  --dashboard            Start HTTP + WS servers and open the browser
 *  --max-retries <n>      Max heal attempts per step (default: 3)
 *  --confidence <n>       Min confidence threshold 0–1 (default: 0.8)
 *  --report               Print a detailed summary table after the run
 *
 * Architecture
 * ─────────────────────────────────────────────────────────────
 *  1. Parse CLI flags with commander.
 *  2. Load selfheal.config.js (reads .env).
 *  3. Merge: config defaults → CLI flags (CLI wins).
 *  4. If --dashboard: start wsServer + httpServer, open browser.
 *  5. Attach chalk-coloured console listeners to runner events.
 *  6. Execute runPipeline(testFile, mergedConfig).
 *  7. If --report: print summary table.
 *  8. Graceful shutdown on SIGINT / run:done.
 * ============================================================
 */

import { program } from "commander";
import path from "path";
import { pathToFileURL } from "url";
import chalk from "chalk";
import { createRequire } from "module";

import baseConfig from "../selfheal.config.js";
import PlaywrightRunner from "../src/runner/playwrightRunner.js";
import { createWsServer }   from "../src/server/wsServer.js";
import { createHttpServer } from "../src/server/httpServer.js";

// ─────────────────────────────────────────────────────────────
// SECTION 1 — OPEN BROWSER HELPER
// ─────────────────────────────────────────────────────────────

/**
 * Open a URL in the system default browser.
 * Works on Windows, macOS, and Linux without extra dependencies.
 *
 * @param {string} url
 * @returns {Promise<void>}
 */
async function openBrowser(url) {
  const { spawn } = await import("child_process");
  const cmds = { win32: ["cmd", ["/c", "start", url]],
                 darwin: ["open", [url]],
                 linux:  ["xdg-open", [url]] };
  const [cmd, args] = cmds[process.platform] ?? cmds.linux;
  spawn(cmd, args, { detached: true, stdio: "ignore" }).unref();
}

// ─────────────────────────────────────────────────────────────
// SECTION 2 — CONSOLE LOGGER (runner event → coloured output)
// ─────────────────────────────────────────────────────────────

/** Attach chalk-coloured listeners to a PlaywrightRunner instance. */
function attachLogger(runner) {
  runner.on("step:start", ({ stepIndex, stepCode }) => {
    const preview = stepCode.replace(/\s+/g, " ").slice(0, 80);
    console.log(chalk.cyan(`  ▶ step ${stepIndex + 1}`) + chalk.dim(` ${preview}`));
  });

  runner.on("step:pass", ({ stepIndex, durationMs }) => {
    console.log(chalk.green(`  ✔ step ${stepIndex + 1}`) + chalk.dim(` (${durationMs}ms)`));
  });

  runner.on("step:fail", ({ stepIndex, error, attemptNumber }) => {
    console.log(
      chalk.red(`  ✘ step ${stepIndex + 1}`) +
      chalk.dim(` attempt ${attemptNumber}`) +
      ` — ${chalk.red(error.message ?? error)}`
    );
  });

  runner.on("heal:start", ({ stepIndex, attemptNumber }) => {
    console.log(chalk.magenta(`  💊 healing step ${stepIndex + 1}`) + chalk.dim(` (attempt ${attemptNumber})…`));
  });

  runner.on("heal:done", ({ healResult }) => {
    if (healResult.confidence > 0 && healResult.newSelector) {
      console.log(
        chalk.yellow(`     ↳ fix found`) +
        chalk.dim(` confidence=${healResult.confidence.toFixed(2)}`) +
        `  selector: ${chalk.yellow(healResult.newSelector)}`
      );
      if (healResult.rootCause) {
        console.log(chalk.dim(`     rootCause: ${healResult.rootCause}`));
      }
    } else {
      console.log(chalk.dim(`     ↳ no confident fix (confidence=${healResult.confidence ?? 0})`));
    }
  });
}

// ─────────────────────────────────────────────────────────────
// SECTION 3 — REPORT PRINTER
// ─────────────────────────────────────────────────────────────

/**
 * Print a detailed summary table after the run.
 * @param {Object} summary — run:done payload from PlaywrightRunner
 */
function printReport(summary) {
  const line = "─".repeat(72);
  console.log("\n" + chalk.bold.white("  Run Report"));
  console.log(chalk.dim("  " + line));

  console.log(
    `  ${chalk.bold("Test:")}   ${summary.testName ?? path.basename(summary.testFile)}`
  );
  console.log(`  ${chalk.bold("File:")}   ${chalk.dim(summary.testFile)}`);
  console.log(
    `  ${chalk.bold("Result:")} ` +
    chalk.green(`${summary.passed} passed`) + "  " +
    chalk.red(`${summary.failed} failed`) + "  " +
    chalk.magenta(`${summary.healed} healed`) + "  " +
    chalk.dim(`${summary.total} total`)
  );
  console.log(`  ${chalk.bold("Time:")}   ${summary.durationMs}ms`);

  console.log(chalk.dim("\n  " + line));
  console.log(chalk.bold("  Steps:"));

  for (const step of summary.steps) {
    const idx = String(step.stepIndex + 1).padStart(3, " ");
    const icon =
      step.status === "pass"    ? chalk.green("✔") :
      step.status === "healed"  ? chalk.yellow("💊") :
      step.status === "fail"    ? chalk.red("✘") :
      chalk.dim("↷");  // skipped

    const code = (step.stepCode ?? "").replace(/\s+/g, " ").slice(0, 55);
    const extra =
      step.status === "fail"   ? chalk.red(` ${step.error?.message?.slice(0, 60) ?? ""}`) :
      step.status === "healed" ? chalk.yellow(` → ${step.healedSelector ?? ""}`) :
      step.durationMs != null  ? chalk.dim(` (${step.durationMs}ms)`) : "";

    console.log(`  ${idx}. ${icon} ${chalk.dim(code)}${extra}`);
  }

  console.log(chalk.dim("  " + line + "\n"));
}

// ─────────────────────────────────────────────────────────────
// SECTION 4 — PIPELINE RUNNER
// ─────────────────────────────────────────────────────────────

/**
 * Execute the full test pipeline:
 *  1. Create and configure a PlaywrightRunner.
 *  2. Attach logger.
 *  3. Run the test file.
 *  4. Return the summary.
 *
 * @param {string} testFile     - Absolute path to the test module.
 * @param {Object} mergedConfig - Final merged config object.
 * @returns {Promise<Object>}   - run:done summary.
 */
async function runPipeline(testFile, mergedConfig) {
  const runner = new PlaywrightRunner(mergedConfig);
  attachLogger(runner);

  console.log(
    "\n" +
    chalk.bold.cyan("  ⚡ SelfHeal") +
    chalk.dim(` v${mergedConfig._version ?? "1.0.0"}`) +
    "\n" +
    chalk.dim(`  Running: ${testFile}`) +
    "\n" +
    chalk.dim(`  maxRetries=${mergedConfig.maxRetries}  `) +
    chalk.dim(`confidence≥${mergedConfig.confidenceThreshold}  `) +
    (mergedConfig.safeMode ? chalk.yellow("safeMode=ON") : chalk.dim("safeMode=off")) +
    "\n"
  );

  const summary = await runner.run(testFile);
  return { runner, summary };
}

// ─────────────────────────────────────────────────────────────
// SECTION 5 — CLI DEFINITION
// ─────────────────────────────────────────────────────────────

program
  .name("selfheal")
  .description("Self-healing Playwright test runner powered by AI")
  .version("1.0.0");

program
  .command("run <testFile>")
  .description("Run a Playwright test file with self-healing enabled")
  .option("--safe",                     "Safe mode: suggest fixes but never rewrite files")
  .option("--dashboard",                "Start the live dashboard (HTTP + WebSocket servers)")
  .option("--max-retries <n>",          "Maximum heal attempts per failing step", parseInt)
  .option("--confidence <n>",           "Minimum heal confidence threshold (0–1)", parseFloat)
  .option("--report",                   "Print a detailed step-by-step report after the run")
  .option("--port <n>",                 "Dashboard HTTP port (overrides config)", parseInt)
  .option("--ws-port <n>",              "WebSocket port (overrides config)", parseInt)
  .action(async (testFile, cliFlags) => {

    // ── 5a. Resolve absolute test file path ───────────────
    const absTestFile = path.isAbsolute(testFile)
      ? testFile
      : path.resolve(process.cwd(), testFile);

    // ── 5b. Merge config: base → CLI flags (CLI wins) ─────
    const mergedConfig = {
      ...baseConfig,
      _version: "1.0.0",
      ...(cliFlags.safe          !== undefined && { safeMode: true }),
      ...(cliFlags.maxRetries    !== undefined && { maxRetries: cliFlags.maxRetries }),
      ...(cliFlags.confidence    !== undefined && { confidenceThreshold: cliFlags.confidence }),
      ...(cliFlags.port          !== undefined && { dashboardPort: cliFlags.port }),
      ...(cliFlags.wsPort        !== undefined && { wsPort: cliFlags.wsPort }),
    };

    // ── 5c. Dashboard: start servers ─────────────────────
    let httpSrv = null;
    let wssSrv  = null;

    if (cliFlags.dashboard) {
      // We need the runner instance before we can bridge events.
      // Technique: create runner first, start servers, then run.
      const runner = new PlaywrightRunner(mergedConfig);
      attachLogger(runner);

      try {
        wssSrv = await createWsServer(runner, {
          port: mergedConfig.wsPort,
          host: "localhost",
        });

        httpSrv = await createHttpServer({
          port:           mergedConfig.dashboardPort,
          host:           "localhost",
          getClientCount: () => wssSrv.clientCount,
        });
      } catch (err) {
        console.error(chalk.red(`  ✘ Could not start servers: ${err.message}`));
        process.exit(1);
      }

      const dashUrl = `http://localhost:${mergedConfig.dashboardPort}`;
      console.log(chalk.green(`\n  ✔ Dashboard`) + `  ${chalk.underline(dashUrl)}`);
      console.log(chalk.green(`  ✔ WebSocket`) + `  ws://localhost:${mergedConfig.wsPort}\n`);

      // Open browser after a short delay so the server is fully up
      setTimeout(() => openBrowser(dashUrl).catch(() => {}), 500);

      // ── Graceful shutdown on Ctrl+C ───────────────────
      const shutdown = async () => {
        console.log(chalk.dim("\n  Shutting down servers…"));
        await wssSrv.shutdown().catch(() => {});
        await httpSrv.shutdown().catch(() => {});
        process.exit(0);
      };
      process.once("SIGINT",  shutdown);
      process.once("SIGTERM", shutdown);

      // Run via the already-created runner (servers already bridged)
      console.log(
        "\n" +
        chalk.bold.cyan("  ⚡ SelfHeal") +
        chalk.dim(` v${mergedConfig._version}`) +
        "\n" +
        chalk.dim(`  Running: ${absTestFile}`) +
        "\n" +
        chalk.dim(`  maxRetries=${mergedConfig.maxRetries}  `) +
        chalk.dim(`confidence≥${mergedConfig.confidenceThreshold}  `) +
        (mergedConfig.safeMode ? chalk.yellow("safeMode=ON") : chalk.dim("safeMode=off")) +
        "\n"
      );

      let summary;
      try {
        summary = await runner.run(absTestFile);
      } catch (err) {
        console.error(chalk.red(`\n  ✘ Fatal: ${err.message}`));
        await shutdown();
        process.exit(1);
      }

      if (cliFlags.report) printReport(summary);

      finalExit(summary, async () => {
        await wssSrv.shutdown().catch(() => {});
        await httpSrv.shutdown().catch(() => {});
      });
      return;
    }

    // ── 5d. No dashboard — straight pipeline run ──────────
    let summary;
    try {
      const result = await runPipeline(absTestFile, mergedConfig);
      summary = result.summary;
    } catch (err) {
      console.error(chalk.red(`\n  ✘ Fatal: ${err.message}`));
      process.exit(1);
    }

    if (cliFlags.report) printReport(summary);
    finalExit(summary);
  });

// ─────────────────────────────────────────────────────────────
// SECTION 6 — FINAL EXIT
// ─────────────────────────────────────────────────────────────

/**
 * Print the one-line outcome and exit with an appropriate code.
 *
 * @param {Object}    summary     - run:done payload.
 * @param {Function}  [cleanup]   - Optional async cleanup before exit.
 */
async function finalExit(summary, cleanup) {
  const ok = summary.failed === 0;

  const icon    = ok ? chalk.green("✔") : chalk.red("✘");
  const outcome = ok ? chalk.green("PASSED") : chalk.red("FAILED");

  console.log(
    `\n  ${icon} ${outcome}` +
    `  ${chalk.green(summary.passed + " passed")}` +
    ` ${chalk.red(summary.failed + " failed")}` +
    ` ${chalk.magenta(summary.healed + " healed")}` +
    chalk.dim(`  (${summary.durationMs}ms)\n`)
  );

  if (cleanup) await cleanup().catch(() => {});
  process.exit(ok ? 0 : 1);
}

// ─────────────────────────────────────────────────────────────
// SECTION 7 — FALLBACK: NO SUB-COMMAND
// ─────────────────────────────────────────────────────────────

program.addHelpText("after", `
Examples:
  selfheal run tests/login.spec.js
  selfheal run tests/login.spec.js --dashboard --report
  selfheal run tests/login.spec.js --safe --max-retries 5 --confidence 0.9
  selfheal run tests/login.spec.js --dashboard --port 4000 --ws-port 4001
`);

// Show help when called with no arguments
if (process.argv.length <= 2) {
  program.help();
}

program.parse(process.argv);
