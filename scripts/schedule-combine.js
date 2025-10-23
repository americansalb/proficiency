#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execPromise = promisify(exec);

console.log('🕐 Video Combination Scheduler Started');
console.log('==========================================');
console.log(`Started at: ${new Date().toLocaleString()}`);
console.log('Running every 8 hours...\n');

const EIGHT_HOURS = 8 * 60 * 60 * 1000; // 8 hours in milliseconds

async function runCombineScript() {
  const timestamp = new Date().toLocaleString();
  console.log(`\n⏰ [${timestamp}] Running video combination script...`);
  console.log('==========================================');

  try {
    const scriptPath = path.join(__dirname, 'combine-videos.js');
    const { stdout, stderr } = await execPromise(`node "${scriptPath}"`);

    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);

    console.log(`✅ [${timestamp}] Combination script completed\n`);
  } catch (error) {
    console.error(`❌ [${timestamp}] Error running combination script:`, error.message);
  }

  console.log(`⏳ Next run scheduled in 8 hours (${new Date(Date.now() + EIGHT_HOURS).toLocaleString()})\n`);
}

// Run immediately on start
runCombineScript();

// Then run every 8 hours
setInterval(runCombineScript, EIGHT_HOURS);

// Keep the process running
process.on('SIGINT', () => {
  console.log('\n\n🛑 Scheduler stopped by user');
  process.exit(0);
});
