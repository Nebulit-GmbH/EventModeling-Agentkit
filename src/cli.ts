#!/usr/bin/env node

import { Command } from 'commander';
import { createInterface } from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  existsSync,
  mkdirSync,
  cpSync,
  rmSync,
  readdirSync,
  statSync,
  writeFileSync,
  readFileSync,
  appendFileSync,
} from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const program = new Command();

program
  .name('eventmodelers')
  .description('Eventmodelers Agent Kit — real-time Claude agent + skills for Claude Code')
  .version('0.1.0');

program
  .command('install')
  .description('Install agent kit into the current directory')
  .action(async () => {
    console.log('🚀 Eventmodelers Agent Kit\n');

    const rl = createInterface({ input, output });

    let token: string;
    let organizationId: string;
    let baseUrl: string;

    try {
      // Check for existing config
      const configPath = join(process.cwd(), '.eventmodelers', 'config.json');
      let existingConfig: Record<string, string> = {};
      if (existsSync(configPath)) {
        try {
          existingConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
          console.log('ℹ️  Found existing .eventmodelers/config.json — press Enter to keep current values.\n');
        } catch {
          // ignore parse errors
        }
      }

      token = (await rl.question(
        existingConfig.token
          ? `API token [${existingConfig.token.slice(0, 8)}…]: `
          : 'API token (from your workspace settings): '
      )) || existingConfig.token || '';

      organizationId = (await rl.question(
        existingConfig.organizationId
          ? `Organization ID [${existingConfig.organizationId.slice(0, 8)}…]: `
          : 'Organization ID (UUID from your workspace): '
      )) || existingConfig.organizationId || '';

      baseUrl = (await rl.question(
        `Base URL [${existingConfig.baseUrl || 'https://api.eventmodelers.de'}]: `
      )) || existingConfig.baseUrl || 'https://api.eventmodelers.de';

      if (!token || !organizationId) {
        console.error('\n❌ Token and organization ID are required.');
        process.exit(1);
      }
    } finally {
      rl.close();
    }

    const targetDir = process.cwd();
    const templatesSource = join(__dirname, '..', 'templates');

    if (!existsSync(templatesSource)) {
      console.error('❌ Templates directory not found at:', templatesSource);
      process.exit(1);
    }

    console.log('\n📦 Installing...\n');

    // Write .eventmodelers/config.json
    const configDir = join(targetDir, '.eventmodelers');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'config.json'),
      JSON.stringify({ token, organizationId, baseUrl }, null, 2)
    );
    console.log('  ✓ Created .eventmodelers/config.json');

    // Add .eventmodelers/ to .gitignore
    const gitignorePath = join(targetDir, '.gitignore');
    const gitignoreEntry = '.eventmodelers/';
    if (existsSync(gitignorePath)) {
      const content = readFileSync(gitignorePath, 'utf-8');
      if (!content.includes(gitignoreEntry)) {
        appendFileSync(gitignorePath, `\n${gitignoreEntry}\n`);
        console.log('  ✓ Added .eventmodelers/ to .gitignore');
      }
    } else {
      writeFileSync(gitignorePath, `${gitignoreEntry}\n`);
      console.log('  ✓ Created .gitignore with .eventmodelers/');
    }

    // Copy template files
    const items = readdirSync(templatesSource);
    for (const item of items) {
      const sourcePath = join(templatesSource, item);
      const targetPath = join(targetDir, item);

      try {
        if (statSync(sourcePath).isDirectory()) {
          cpSync(sourcePath, targetPath, {
            recursive: true,
            filter: (src) => !src.includes('node_modules'),
          });
        } else {
          cpSync(sourcePath, targetPath);
        }
        console.log(`  ✓ Installed ${item}`);
      } catch (err: any) {
        console.error(`  ❌ Failed to copy ${item}:`, err?.message);
      }
    }

    console.log('\n✅ Done!\n');
    console.log('Next steps:');
    console.log('  1. Start the real-time agent:');
    console.log('       cd realtime-agent && npm install && npm run dev');
    console.log('  2. Open Claude Code in this directory — skills are ready in .claude/skills/');
    console.log('  3. Use /connect to set a board ID, then /timeline, /wdyt, /storyboard, etc.');
  });

program
  .command('uninstall')
  .description('Remove agent kit files from current directory')
  .action(() => {
    const targets = [
      join(process.cwd(), '.claude', 'skills'),
      join(process.cwd(), 'realtime-agent'),
      join(process.cwd(), '.eventmodelers'),
    ];

    for (const t of targets) {
      if (existsSync(t)) {
        rmSync(t, { recursive: true, force: true });
        console.log(`  ✓ Removed ${t}`);
      }
    }

    console.log('✅ Uninstalled');
  });

program
  .command('status')
  .description('Check installation status')
  .action(() => {
    const skillsDir = join(process.cwd(), '.claude', 'skills');
    const configPath = join(process.cwd(), '.eventmodelers', 'config.json');
    const agentDir = join(process.cwd(), 'realtime-agent');

    console.log('Eventmodelers Agent Kit Status\n');
    console.log(`Skills:         ${existsSync(skillsDir) ? '✅ installed' : '❌ not found'}`);
    console.log(`Config:         ${existsSync(configPath) ? '✅ present' : '❌ missing'}`);
    console.log(`Realtime agent: ${existsSync(agentDir) ? '✅ present' : '❌ missing'}`);

    if (existsSync(configPath)) {
      try {
        const cfg = JSON.parse(readFileSync(configPath, 'utf-8'));
        console.log(`\nConnected to: ${cfg.baseUrl}`);
        console.log(`Organization: ${cfg.organizationId}`);
      } catch {
        console.log('\n⚠️  Config file is invalid JSON');
      }
    }
  });

program.parse();
