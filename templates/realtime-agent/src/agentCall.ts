import { spawn } from 'child_process';

export async function callAgent(prompt: string, cwd: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const proc = spawn('claude', ['-p', prompt, '--dangerously-skip-permissions'], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    proc.stdout.on('data', (data) => process.stdout.write(`[claude] ${data}`));
    proc.stderr.on('data', (data) => process.stderr.write(`[claude] ${data}`));

    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`claude exited with code ${code}`));
    });

    proc.on('error', reject);
  });
}
