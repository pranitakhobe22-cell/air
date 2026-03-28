#!/usr/bin/env node
import { chromium } from '@playwright/test';
import { executeCLI } from './cliRunner.js';

const args = process.argv.slice(2);
const command = args[0];

if (command !== 'run') {
  console.log('Usage: npx selfheal run <file> [--dashboard]');
  process.exit(1);
}

const testFile = args[1];
const dashboard = args.includes('--dashboard');

import { scoreFragility } from '../src/selector/fragilityScorer.js';

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

executeCLI(testFile, dashboard);

