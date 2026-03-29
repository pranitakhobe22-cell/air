#!/usr/bin/env node
import { runCommandWithHealing } from '../src/runner/execRunner.js';

const args = process.argv.slice(2);
const command = args[0];

if (command === 'exec') {
  const cmdStr = args.slice(1).join(' ');
  if (!cmdStr) {
    console.log('Usage: npx selfheal exec "<command>"');
    process.exit(1);
  }
  runCommandWithHealing(cmdStr).then(code => process.exit(code));
} else if (command === 'run') {
  const testFile = args[1];
  const dashboard = args.includes('--dashboard');

  import('../src/selector/fragilityScorer.js').then(({ scoreFragility }) => {
    const scores = scoreFragility(testFile);
    if (scores && scores.length > 0) {
      console.log(`\n   Fragility scan — ${testFile}`);
      console.log('   ----------------------------------------');
      scores.forEach(s => {
        const scoreStr = s.fragilityScore.toString().padEnd(5);
        let riskLabel = s.risk === 'high' ? 'HIGH RISK' : (s.risk === 'low' ? 'stable' : 'moderate');
        console.log(`   ${s.selector.padEnd(22)} ${scoreStr} ${riskLabel}`);
      });
      console.log('');
    }
    import('./cliRunner.js').then(({ executeCLI }) => {
      executeCLI(testFile, dashboard);
    });
  });
} else {
  console.log('Usage:');
  console.log('  npx selfheal run <file> [--dashboard]');
  console.log('  npx selfheal exec "<command>"');
  process.exit(1);
}
