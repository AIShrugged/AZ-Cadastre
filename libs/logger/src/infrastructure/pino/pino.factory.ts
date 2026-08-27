import pino from 'pino';
import { PinoPretty } from 'pino-pretty';

import type { LoggerModuleOptions } from '../../logger.module-defs.js';

/**
 * Streams run in-process rather than through `pino.transport()`: its worker
 * threads (thread-stream) crash under `node --watch`, which is how `pnpm dev`
 * runs this service.
 *
 * One destination today, the console — there is no log collector to ship to,
 * and inventing one would be a deployment decision made in a factory
 * (ADR-0008). A second destination is a second entry in `streams` and nothing
 * else; until there is one, plain JSON on stdout keeps pino's fast path, which
 * is why the single-stream case does not go through `multistream`.
 */
export const createPinoLogger = (options: LoggerModuleOptions): pino.Logger => {
  const level = options.level ?? 'info';
  const base = {
    app: 'az-cadastre',
    environment: process.env.NODE_ENV ?? 'development',
    service: options.service,
  };

  if (!options.pretty) return pino({ level, base });

  const streams: pino.StreamEntry[] = [
    {
      level: level as pino.Level,
      stream: PinoPretty({
        colorize: true,
        // The epoch milliseconds pino writes are for a machine; a person
        // reading a pipeline run wants to see how long a stage took.
        translateTime: 'SYS:HH:MM:ss.l',
        // Constant on every line of a process, so they say nothing here. They
        // are still in the JSON the collector would receive.
        ignore: 'app,environment',
      }),
    },
  ];

  return pino({ level, base }, pino.multistream(streams));
};
