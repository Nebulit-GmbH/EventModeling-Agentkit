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
import { execSync } from 'child_process';

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

    const targetDir = process.cwd();

    const templatesSource = join(__dirname, '..', 'templates');

    if (!existsSync(templatesSource)) {
      console.error('❌ Templates directory not found at:', templatesSource);
      process.exit(1);
    }

    // Copy template files first — credentials not required for this
    console.log('📦 Installing files...\n');
    const items = readdirSync(templatesSource);
    for (const item of items) {
      const sourcePath = join(templatesSource, item);

      // templates/root/ contents are spread directly into the project root
      if (item === 'root' && statSync(sourcePath).isDirectory()) {
        const rootItems = readdirSync(sourcePath);
        for (const rootItem of rootItems) {
          const rootSourcePath = join(sourcePath, rootItem);
          const rootTargetPath = join(targetDir, rootItem);
          try {
            if (statSync(rootSourcePath).isDirectory()) {
              cpSync(rootSourcePath, rootTargetPath, { recursive: true });
            } else {
              cpSync(rootSourcePath, rootTargetPath);
            }
            console.log(`  ✓ Installed ${rootItem}`);
          } catch (err: any) {
            console.error(`  ❌ Failed to copy ${rootItem}:`, err?.message);
          }
        }
        continue;
      }

      const targetPath = join(targetDir, item);
      try {
        if (statSync(sourcePath).isDirectory()) {
          cpSync(sourcePath, targetPath, {
            recursive: true,
            filter: (src) => !src.substring(templatesSource.length).includes('node_modules'),
          });
        } else {
          cpSync(sourcePath, targetPath);
        }
        console.log(`  ✓ Installed ${item}`);
      } catch (err: any) {
        console.error(`  ❌ Failed to copy ${item}:`, err?.message);
      }
    }

    // Install realtime-agent dependencies
    const agentDir = join(targetDir, 'realtime-agent');
    if (existsSync(agentDir)) {
      console.log('\n📦 Installing realtime-agent dependencies...');
      try {
        execSync('npm install', { cwd: agentDir, stdio: 'inherit' });
        console.log('  ✓ realtime-agent dependencies installed');
      } catch {
        console.error('  ⚠️  npm install failed in realtime-agent — run it manually');
      }
    }

    // Add .eventmodelers/ to .gitignore
    const gitignorePath = join(targetDir, '.gitignore');
    const gitignoreEntry = '.eventmodelers/';
    if (existsSync(gitignorePath)) {
      const content = readFileSync(gitignorePath, 'utf-8');
      if (!content.includes(gitignoreEntry)) {
        appendFileSync(gitignorePath, `\n${gitignoreEntry}\n`);
      }
    } else {
      writeFileSync(gitignorePath, `${gitignoreEntry}\n`);
    }

    // Ask for credentials
    console.log('\n🔑 Configure credentials:\n');
    const rl2 = createInterface({ input, output });
    try {
      const hasConfig = (await rl2.question(
        'Have you already copied your config from https://app.eventmodelers.de/account? (y/n): '
      )).trim().toLowerCase();

      if (hasConfig === 'y' || hasConfig === 'yes') {
        console.log('\nPaste your config below and press Enter twice when done:\n');
        const lines: string[] = [];
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const line = await rl2.question('');
          if (line === '') break;
          lines.push(line);
        }
        const raw = lines.join('\n').trim();
        if (raw) {
          const configDir = join(targetDir, '.eventmodelers');
          mkdirSync(configDir, { recursive: true });
          writeFileSync(join(configDir, 'config.json'), raw);
          console.log('  ✓ Config saved to .eventmodelers/config.json');
        } else {
          console.log('\n⚠️  Nothing pasted — config not saved.');
        }
      } else {
        const configPath = join(targetDir, '.eventmodelers', 'config.json');
        let existingConfig: Record<string, unknown> = {};
        if (existsSync(configPath)) {
          try {
            existingConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
            console.log('ℹ️  Found existing config — press Enter to keep current values.\n');
          } catch { /* ignore */ }
        }

        const existingToken = existingConfig.token as string | undefined;
        const existingBoardId = existingConfig.boardId as string | undefined;
        const existingOrgId = existingConfig.organizationId as string | undefined;
        const existingBaseUrl = existingConfig.baseUrl as string | undefined;
        const existingShowOutput = existingConfig.showOutput as boolean | undefined;

        const token = (await rl2.question(
          existingToken
            ? `API token [${existingToken.slice(0, 8)}…]: `
            : 'API token: '
        )) || existingToken || '';

        const organizationId = (await rl2.question(
          existingOrgId
            ? `Organization ID [${existingOrgId.slice(0, 8)}…]: `
            : 'Organization ID: '
        )) || existingOrgId || '';

        const boardId = (await rl2.question(
          existingBoardId
            ? `Board ID [${existingBoardId.slice(0, 8)}…]: `
            : 'Board ID (optional, press Enter to skip): '
        )) || existingBoardId || '';

        const baseUrl = (await rl2.question(
          `Base URL [${existingBaseUrl || 'https://api.eventmodelers.de'}]: `
        )) || existingBaseUrl || 'https://api.eventmodelers.de';

        const showOutputDefault = existingShowOutput !== undefined ? existingShowOutput : true;
        const showOutputAnswer = (await rl2.question(
          `Show LLM output in terminal (true/false) [${showOutputDefault}]: `
        )) || String(showOutputDefault);
        const showOutput = showOutputAnswer.trim().toLowerCase() !== 'false';

        if (token && organizationId) {
          const configDir = join(targetDir, '.eventmodelers');
          mkdirSync(configDir, { recursive: true });
          writeFileSync(
            join(configDir, 'config.json'),
            JSON.stringify({ token, boardId, organizationId, baseUrl, showOutput }, null, 2)
          );
          console.log('  ✓ Saved .eventmodelers/config.json');
        } else {
          console.log('\n⚠️  Skipped credentials. Run the install again to set them when ready.');
        }
      }
    } finally {
      rl2.close();
    }

    console.log('\n✅ Done!\n');
    console.log('Next steps — run both in separate terminals:\n');
    console.log('  Terminal 1 — realtime agent (picks up prompts → writes tasks.json):');
    console.log('       cd realtime-agent && npm run dev\n');
    console.log('  Terminal 2 — ralph loop (reads tasks.json → executes via Claude):');
    console.log('       ./ralph.sh\n');
    console.log('Both run indefinitely. The loop waits when tasks.json is empty.');
    console.log('\nSkills are ready in .claude/skills/ — use /connect to set a board ID.');
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
    const skillsDir
        = join(process.cwd(), '.claude', 'skills');
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
