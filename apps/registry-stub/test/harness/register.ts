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
 * Runs the built entry point as its own process rather than assembling a Nest
 * testing module: main.ts validates the environment, installs the global pipe
 * and sets the `api` prefix, and a module assembled by hand would agree with
 * the code under test by construction.
 */
export async function startRegister(
  env: Readonly<Record<string, string>>,
  readyTimeout = 30_000,
): Promise<StartedRegister> {
  const cwd = path.join(import.meta.dirname, '..', '..');
  const port = env.SERVICE_PORT ?? '3310';
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
    await fetch(url);
    return true;
  } catch {
    return false;
  }
}
