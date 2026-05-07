import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { callAgent } from './agentCall.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface LocalConfig {
  token: string;
  organizationId: string;
  baseUrl: string;
}

interface PlatformConfig extends LocalConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

interface Prompt {
  id: string;
  prompt: string;
  board_id: string;
  timeline_id: string;
  organization_id: string;
  user_id: string;
  creation_time: string;
  priority: boolean;
}

function loadLocalConfig(): LocalConfig {
  // Look for config in the project root (two levels up from src/)
  const configPath = resolve(__dirname, '../../.eventmodelers/config.json');
  const raw = readFileSync(configPath, 'utf-8');
  const cfg = JSON.parse(raw) as Partial<LocalConfig>;

  for (const key of ['token', 'organizationId', 'baseUrl'] as const) {
    if (!cfg[key]) throw new Error(`Missing config field: ${key}`);
  }

  if (process.env.BASE_URL) cfg.baseUrl = process.env.BASE_URL;

  return cfg as LocalConfig;
}

async function fetchPlatformConfig(local: LocalConfig): Promise<PlatformConfig> {
  const res = await fetch(`${local.baseUrl}/api/config`, {
    headers: { 'x-token': local.token },
  });
  if (!res.ok) throw new Error(`Failed to fetch platform config: ${res.status} / ${res.statusText} / ${await res.text()}`);
  const remote = await res.json() as { supabaseUrl: string; supabaseAnonKey: string };
  return { ...local, ...remote };
}

async function getRealtimeToken(cfg: PlatformConfig): Promise<string> {
  const res = await fetch(`${cfg.baseUrl}/api/prompts/realtime-token`, {
    headers: { 'x-token': cfg.token },
  });
  if (!res.ok) throw new Error(`Failed to get realtime token: ${res.status} / ${res.statusText} / ${await res.text()}`);
  const { token } = await res.json() as { token: string };
  return token;
}

async function fetchNextPrompt(cfg: PlatformConfig, jwtToken: string): Promise<Prompt | null> {
  const res = await fetch(`${cfg.baseUrl}/api/prompts/next`, {
    headers: { 'x-token': cfg.token, 'Authorization': `Bearer ${jwtToken}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch prompt: ${res.status} / ${res.statusText} / ${await res.text()}`);
  return res.json() as Promise<Prompt>;
}

async function acknowledgePrompt(cfg: PlatformConfig, id: string, jwtToken: string): Promise<void> {
  const res = await fetch(`${cfg.baseUrl}/api/prompts/${id}`, {
    method: 'DELETE',
    headers: { 'x-token': cfg.token, 'Authorization': `Bearer ${jwtToken}` },
  });
  if (res.status !== 204 && res.status !== 404) {
    throw new Error(`Failed to acknowledge prompt ${id}: ${res.status} / ${res.statusText} / ${await res.text()}`);
  }
}

async function processPrompt(prompt: Prompt, cfg: PlatformConfig, jwtToken: string, claudeCwd: string): Promise<void> {
  console.log(`[agent] Processing prompt "${prompt.prompt}" (board=${prompt.board_id}, priority=${prompt.priority})`);

  await callAgent({
    boardId: prompt.board_id,
    timelineId: prompt.timeline_id,
    organizationId: prompt.organization_id,
    token: cfg.token,
    baseUrl: cfg.baseUrl,
    prompt: prompt.prompt,
    cwd: claudeCwd,
  });
}

async function drainQueue(cfg: PlatformConfig, jwtToken: string, claudeCwd: string): Promise<void> {
  let prompt: Prompt | null;
  while ((prompt = await fetchNextPrompt(cfg, jwtToken)) !== null) {
    try {
      await processPrompt(prompt, cfg, jwtToken, claudeCwd);
      await acknowledgePrompt(cfg, prompt.id, jwtToken);
    } catch (err) {
      console.error(`[agent] Error processing prompt ${prompt.id}:`, err);
      break;
    }
  }
}

async function start(): Promise<void> {
  const claudeCwd = process.argv[2] ?? process.cwd();

  const local = loadLocalConfig();
  const cfg = await fetchPlatformConfig(local);

  console.log(`[agent] Starting — org=${cfg.organizationId}, base=${cfg.baseUrl}, cwd=${claudeCwd}`);

  let realtimeToken = await getRealtimeToken(cfg);

  const supabase = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    realtime: { params: { apikey: cfg.supabaseAnonKey } },
  });

  await supabase.realtime.setAuth(realtimeToken);

  supabase
    .channel(`org:${cfg.organizationId}`, { config: { private: true } })
    .on('broadcast', { event: 'prompt:created' }, async () => {
      console.log('[agent] New prompt received');
      await drainQueue(cfg, realtimeToken, claudeCwd).catch((err) => console.error('[agent] Queue drain error:', err));
    })
    .subscribe(async (status) => {
      await drainQueue(cfg, realtimeToken, claudeCwd).catch((err) => console.error('[agent] Queue drain error:', err));
      console.log(`[agent] Realtime channel status: ${status}`);
    });

  setInterval(async () => {
    try {
      realtimeToken = await getRealtimeToken(cfg);
      supabase.realtime.setAuth(realtimeToken);
      console.log('[agent] Realtime token refreshed');
    } catch (err) {
      console.error('[agent] Token refresh failed:', err);
    }
  }, 50 * 60 * 1000);

  const ping = async () => {
    try {
      const res = await fetch(`${cfg.baseUrl}/api/agent-alive`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${realtimeToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: cfg.token }),
      });
      if (!res.ok) console.error(`[agent] Ping failed: ${res.status}`);
    } catch (err) {
      console.error('[agent] Ping error:', err);
    }
  };

  await ping();
  setInterval(ping, 10 * 1000);
}

start().catch((err) => {
  console.error('[agent] Fatal:', err);
  process.exit(1);
});