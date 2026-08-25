import type { CommandBus } from '@nestjs/cqrs';
import { describe, expect, it } from 'vitest';

import { SilentLogger } from '@cadastre/logger';

import { PackageSubmitted } from '../../domain/events/index.js';
import {
  PackageId,
  VerificationProfile,
} from '../../domain/value-objects/index.js';
import { RunVerificationCommand } from '../use-cases/index.js';

import { RunVerificationOnSubmissionHandler } from './run-verification-on-submission.handler.js';

class RecordingCommandBus {
  readonly executed: RunVerificationCommand[] = [];

  execute(command: RunVerificationCommand): Promise<void> {
    this.executed.push(command);
    return Promise.resolve();
  }
}

function submission(packageId: string): PackageSubmitted {
  return new PackageSubmitted(
    PackageId.of(packageId),
    VerificationProfile.of('cadastre'),
    2,
  );
}

describe('RunVerificationOnSubmissionHandler', () => {
  it('runs the pipeline over the package that was submitted', () => {
    const bus = new RecordingCommandBus();

    new RunVerificationOnSubmissionHandler(
      bus as unknown as CommandBus,
      new SilentLogger(),
    ).handle(submission('package-1'));

    expect(bus.executed).toEqual([new RunVerificationCommand('package-1')]);
  });

  it('does not wait for the pipeline it started', () => {
    const started = new Promise<void>(() => undefined);
    const bus = { execute: () => started } as unknown as CommandBus;

    const handled = new RunVerificationOnSubmissionHandler(
      bus,
      new SilentLogger(),
    ).handle(submission('package-2'));

    expect(handled).toBeUndefined();
  });

  it('absorbs a pipeline that fails, because no caller is left to tell', async () => {
    const bus = {
      execute: () => Promise.reject(new Error('pipeline stopped')),
    } as unknown as CommandBus;

    expect(() =>
      new RunVerificationOnSubmissionHandler(bus, new SilentLogger()).handle(
        submission('package-3'),
      ),
    ).not.toThrow();

    await Promise.resolve();
  });
});
