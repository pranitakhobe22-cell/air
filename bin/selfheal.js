#!/usr/bin/env node
/**
 * selfheal CLI
 * ============================================================
 * Usage:
 *   selfheal <any command>              — Run command with auto-healing
 *   selfheal run <file> [--dashboard]   — Run Playwright test with healing
 *   selfheal scan <file> [--json]       — Fragility scan
 *
 * Examples:
 *   selfheal npm run dev
 *   selfheal npm run build
 *   selfheal node server.js
 *   selfheal run tests/checkout.spec.js --dashboard
 * ============================================================
 */

import { runCommandWithHealing } from '../src/runner/execRunner.js';

const args = process.argv.slice(2);
const command = args[0];

// ── Known subcommands ────────────────────────────────────────
if (command === 'run') {
  const testFile = args[1];
  if (!testFile) {
    console.error('  [ERR] Missing test file.\n  Usage: selfheal run <file> [--dashboard] [--ci]');
    process.exit(1);
  }

  const dashboard = args.includes('--dashboard');
  const ciMode = args.includes('--ci');

  import('../src/selector/fragilityScorer.js').then(({ scoreFragility }) => {
    const scores = scoreFragility(testFile);

    if (!ciMode && scores && scores.length > 0) {
      console.log(`\n   Fragility scan — ${testFile}`);
      console.log('   ----------------------------------------');
      scores.forEach(s => {
        const scoreStr = s.fragilityScore.toString().padEnd(5);
        let riskLabel = s.risk === 'high' ? 'HIGH RISK' : (s.risk === 'low' ? 'stable' : 'moderate');
        console.log(`   ${s.selector.padEnd(22)} ${scoreStr} ${riskLabel}`);
      });
      console.log('');
    }

    if (ciMode) {
      import('./ciRunner.js').then(({ executeCI }) => executeCI(testFile, scores));
    } else {
      import('./cliRunner.js').then(({ executeCLI }) => executeCLI(testFile, dashboard));
    }
  });

} else if (command === 'scan') {
  const testFile = args[1];
  if (!testFile) {
    console.error('  [ERR] Missing test file.\n  Usage: selfheal scan <file> [--json]');
    process.exit(1);
  }

  import('../src/selector/fragilityScorer.js').then(({ scoreFragility }) => {
    const scores = scoreFragility(testFile);
    if (!scores || scores.length === 0) {
      console.log('  No selectors found to scan.');
      process.exit(0);
    }

    console.log(`\n   Fragility scan — ${testFile}`);
    console.log('   ----------------------------------------');
    let highRiskCount = 0;
    scores.forEach(s => {
      const scoreStr = s.fragilityScore.toString().padEnd(5);
      let riskLabel = s.risk === 'high' ? 'HIGH RISK' : (s.risk === 'low' ? 'stable' : 'moderate');
      if (s.risk === 'high') highRiskCount++;
      console.log(`   ${s.selector.padEnd(22)} ${scoreStr} ${riskLabel}`);
    });
    console.log(`\n   Total: ${scores.length} selectors | ${highRiskCount} high-risk\n`);
    if (args.includes('--json')) {
      console.log(JSON.stringify({ testFile, scores, summary: { total: scores.length, highRisk: highRiskCount } }, null, 2));
    }
    process.exit(highRiskCount > 0 ? 1 : 0);
  });

} else if (command === '--help' || command === '-h' || !command) {
  console.log('');
  console.log('  SelfHeal — AI-Powered CLI Error Healer');
  console.log('  ======================================');
  console.log('');
  console.log('  Usage:');
  console.log('    selfheal <command>                     Run any command with auto-healing');
  console.log('    selfheal run <file> [--dashboard]      Run Playwright test with healing');
  console.log('    selfheal scan <file> [--json]          Static fragility scan');
  console.log('');
  console.log('  Examples:');
  console.log('    selfheal npm run dev');
  console.log('    selfheal npm run build');
  console.log('    selfheal node server.js');
  console.log('    selfheal run tests/checkout.spec.js --dashboard');
  console.log('');
  process.exit(0);

} else {
  // ── Default: wrap ANY command with healing ─────────────────
  // selfheal npm run dev  →  runs "npm run dev" with error capture + AI healing
  const fullCommand = args.join(' ');
  runCommandWithHealing(fullCommand).then(code => process.exit(code));
}
