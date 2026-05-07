import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { randomUUID } from 'crypto';

export interface Prompt {
  id: string;
  prompt: string;
  board_id: string;
  timeline_id: string;
  organization_id: string;
  user_id: string;
  creation_time: string;
  priority: boolean;
}

interface Task {
  id: string;
  createdAt: string;
  prompts: Prompt[];
}

export async function writeTask(prompts: Prompt[], cwd: string): Promise<void> {
  const tasksPath = resolve(cwd, 'tasks.json');

  const existing: Task[] = existsSync(tasksPath)
    ? (JSON.parse(readFileSync(tasksPath, 'utf-8')) as Task[])
    : [];

  const task: Task = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    prompts,
  };

  existing.push(task);
  writeFileSync(tasksPath, JSON.stringify(existing, null, 2), 'utf-8');
  console.log(`[agent] Task ${task.id} written with ${prompts.length} prompt(s)`);
}