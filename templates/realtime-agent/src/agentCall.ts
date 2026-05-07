import { spawn } from 'child_process';

interface AgentCallOptions {
  boardId: string;
  timelineId: string;
  organizationId: string;
  token: string;
  baseUrl: string;
  prompt: string;
  cwd: string;
}

export async function callAgent(options: AgentCallOptions): Promise<void> {
  const { prompt, cwd } = options;
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
