import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const READY_INTERVAL = 250;
const SHUTDOWN_GRACE = 10_000;

export type StartedRegister = {
  readonly baseUrl: string;
  readonly stop: () => Promise<void>;
};

/**
 * The archive register, running beside the API for the duration of this set.
 *
 * A real process and not a stubbed port, for the same reason the API itself is
 * one: the archive-search route is a door onto a system outside this one
 * (ADR-0009), and what it is worth checking is that a lookup travels the whole
 * way — the gateway's route, its HTTP client, the register's own pipe and
 * database — and comes back in the published shape. A fake registry client
 * would agree with the gateway by construction.
 *
 * `apps/registry-stub` is the stand-in that serves the contract today. When a
 * real register serves it, this is what the set stops needing.
 */
export async function startRegister(
  env: Readonly<Record<string, string>>,
  readyTimeout = 30_000,
): Promise<StartedRegister> {
  const cwd = path.join(import.meta.dirname, '..', '..', '..', 'registry-stub');
  const port = env.SERVICE_PORT ?? '3311';
  const baseUrl = `http://127.0.0.1:${port}`;

  const register: ChildProcess = spawn(process.execPath, ['build/main.js'], {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const output: string[] = [];
  const record = (chunk: Buffer): void => {
    output.push(chunk.toString());
    if (process.env.API_SERVER_LOGS) process.stdout.write(chunk);
  };
  register.stdout?.on('data', record);
  register.stderr?.on('data', record);

  let exited = false;
  register.once('exit', () => {
    exited = true;
  });

  const deadline = Date.now() + readyTimeout;

  for (;;) {
    if (exited) {
      throw new Error(
        `The register exited during start-up:\n${output.join('')}`,
      );
    }
    if (await answers(`${baseUrl}/api/health`)) break;
    if (Date.now() > deadline) {
      register.kill('SIGKILL');
      throw new Error(
        `The register did not answer on ${baseUrl} within ${readyTimeout}ms:\n${output.join('')}`,
      );
    }
    await delay(READY_INTERVAL);
  }

  return {
    baseUrl,
    stop: async () => {
      if (exited) return;
      register.kill('SIGTERM');

      const shutdown = Date.now() + SHUTDOWN_GRACE;
      while (!exited) {
        if (Date.now() > shutdown) {
          register.kill('SIGKILL');
          break;
        }
        await delay(READY_INTERVAL);
      }
    },
  };
}

async function answers(url: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}
