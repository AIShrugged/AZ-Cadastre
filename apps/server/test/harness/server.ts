import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const READY_INTERVAL = 250;
const SHUTDOWN_GRACE = 10_000;

export type StartedServer = {
  readonly baseUrl: string;
  readonly stop: () => Promise<void>;
};

/**
 * Runs the built entry point as its own process, rather than assembling a Nest
 * testing module that mirrors it.
 *
 * That is the whole point of this set: main.ts validates the environment,
 * installs the global pipe, sets the `api` prefix and enables CORS, and none of
 * that is exercised by anything below. A module assembled by hand would agree
 * with the code under test by construction, and would keep agreeing after
 * main.ts stopped doing one of those four things.
 */
export async function startServer(
  env: Readonly<Record<string, string>>,
  readyTimeout = 60_000,
): Promise<StartedServer> {
  const cwd = path.join(import.meta.dirname, '..', '..');
  const port = env.SERVICE_PORT ?? '3210';
  const baseUrl = `http://127.0.0.1:${port}`;

  const server: ChildProcess = spawn(process.execPath, ['build/main.js'], {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const output: string[] = [];
  const record = (chunk: Buffer): void => {
    output.push(chunk.toString());
    if (process.env.API_SERVER_LOGS) process.stdout.write(chunk);
  };
  server.stdout?.on('data', record);
  server.stderr?.on('data', record);

  let exited = false;
  server.once('exit', () => {
    exited = true;
  });

  const deadline = Date.now() + readyTimeout;

  for (;;) {
    if (exited) {
      throw new Error(`The API exited during start-up:\n${output.join('')}`);
    }
    // Any answer means the listener is up; the status is beside the point.
    if (await answers(`${baseUrl}/api/profiles`)) break;
    if (Date.now() > deadline) {
      server.kill('SIGKILL');
      throw new Error(
        `The API did not answer on ${baseUrl} within ${readyTimeout}ms:\n${output.join('')}`,
      );
    }
    await delay(READY_INTERVAL);
  }

  return {
    baseUrl,
    stop: async () => {
      if (exited) return;
      server.kill('SIGTERM');

      const shutdown = Date.now() + SHUTDOWN_GRACE;
      while (!exited) {
        if (Date.now() > shutdown) {
          server.kill('SIGKILL');
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
