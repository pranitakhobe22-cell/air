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

executeCLI(testFile, dashboard);
