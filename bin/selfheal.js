#!/usr/bin/env node
import { Command } from 'commander';
import { executeCLI } from './cliRunner.js';
import { scoreFragility } from '../src/intent/fragilityScorer.js';
import open from 'open';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';

const program = new Command();

program
  .name('selfheal')
  .description('AI-Powered Self-Healing Test Automation')
  .version('2.1.0');

// ── Command: RUN ────────────────────────────────────────────────────────
program
  .command('run <file>')
  .description('Run a test script with the SelfHeal Engine interceptor')
  .option('-d, --dashboard', 'Open the real-time visualization dashboard in your browser')
  .option('-p, --panel', 'Run in embedded VS Code panel mode (internal use)')
  .action((file, options) => {
    executeCLI(file, options.dashboard || false, options.panel || false);
  });

// ── Command: SCAN ───────────────────────────────────────────────────────
program
  .command('scan <file>')
  .description('Statically scan selectors in a test file for brittleness before committing')
  .action((file) => {
    const absPath = path.resolve(file);
    if (!fs.existsSync(absPath)) {
        console.log(chalk.red(`\n❌ Error: File not found: ${absPath}\n`));
        process.exit(1);
    }
    
    console.log(chalk.bold.cyan(`\n🔍 Scanning selectors in ${path.basename(absPath)}...`));
    const scores = scoreFragility(absPath);
    
    if (scores.length === 0) {
        console.log(chalk.green(`\n✅ No fragile selectors detected! Your locators are resilient.\n`));
        return;
    }
    
    console.log(`\nFound ${scores.length} actionable selector(s):\n`);
    scores.forEach(s => {
        let riskLabel = chalk.green('LOW RISK');
        if (s.fragilityScore > 0.5) riskLabel = chalk.red('HIGH RISK');
        else if (s.fragilityScore > 0.2) riskLabel = chalk.yellow('MED RISK');
        
        console.log(`  ${riskLabel.padEnd(25)} [Score: ${s.fragilityScore.toFixed(2)}]  ${chalk.gray(s.selector)}`);
    });
    console.log('\n');
  });

// ── Command: PANEL ──────────────────────────────────────────────────────
program
  .command('panel')
  .description('Toggle open the SelfHeal interactive UI panel inside your VS Code instance')
  .action(async () => {
    console.log(chalk.cyan('\n✨ Sending deep-link shortcut to VS Code to launch the SelfHeal UI...\n'));
    // Triggers the custom URI handler in the VS Code extension
    const url = 'vscode://selfheal.selfheal-vscode/toggle';
    try {
        await open(url);
    } catch(err) {
        console.log(chalk.yellow('Could not open VS Code automatically. Make sure the extension is installed.'));
    }
  });

program.parse();
