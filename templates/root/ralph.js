#!/usr/bin/env node
// Eventmodelers agent loop — processes tasks.json when entries are present
//
// Triggered by: tasks.json has entries (written by the realtime-agent)
//
// Usage: node ralph.js [iterations] [project_dir]
//   iterations  — number of loop cycles to run; 0 or omitted means run forever
//   project_dir — defaults to current working directory

import { existsSync, readFileSync } from 'fs';
import { spawn } from 'child_process';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const iterations = parseInt(process.argv[2] ?? '0', 10);
const projectDir = resolve(process.argv[3] ?? '.');
const tasksFile = join(projectDir, 'tasks.json');
const promptFile = join(projectDir, 'prompt.md');
const agentScript = join(projectDir, 'agent.js');

if (!existsSync(join(projectDir, '.eventmodelers', 'config.json'))) {
  console.error(`ERROR: No .eventmodelers/config.json found in ${projectDir}`);
  process.exit(1);
}

console.log(`Eventmodelers agent — project: ${projectDir}`);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function hasPendingTasks() {
  if (!existsSync(tasksFile)) return false;
  const content = readFileSync(tasksFile, 'utf-8').trim();
  return content !== '[]' && content !== '';
}

function timestamp() {
  return new Date().toISOString().slice(11, 19);
}

async function runAgent(label, prompt) {
  while (true) {
    console.log(`[${timestamp()}] ${label}`);
    const ok = await new Promise((resolve) => {
      const child = spawn('node', [agentScript, prompt], { cwd: projectDir, stdio: 'inherit' });
      child.on('close', (code) => resolve(code === 0));
    });
    if (ok) return;
    console.log(`[${timestamp()}] Agent error — retrying in 60s...`);
    await sleep(60_000);
  }
}

async function main() {
  let cycle = 0;
  while (iterations === 0 || cycle < iterations) {
    if (hasPendingTasks()) {
      const prompt = readFileSync(promptFile, 'utf-8');
      await runAgent('Processing tasks...', prompt);
    } else {
      await sleep(3_000);
    }
    cycle++;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
