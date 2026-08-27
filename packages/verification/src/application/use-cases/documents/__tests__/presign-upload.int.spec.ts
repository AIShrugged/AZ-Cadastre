import { CommandBus } from '@nestjs/cqrs';
import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import {
  InMemoryObjectStorage,
  startContext,
} from '../../../../../test/context-harness.js';
import { FileTooLargeException } from '../../../../domain/exceptions/index.js';
import { FileSize } from '../../../../domain/value-objects/index.js';
import type { PresignedUpload } from '../../../ports/outbound/index.js';
import { PresignUploadCommand } from '../presign-upload/index.js';

/*
 * This use case touches no table, so what it earns here is not database
 * coverage: it is the only proof that the command is registered and reaches its
 * handler through the module the composition root assembles. Nothing else in
 * the repository covers it at all.
 */
describe('PresignUploadCommand', () => {
  let module: TestingModule;
  let storage: InMemoryObjectStorage;
  let commands: CommandBus;

  beforeAll(async () => {
    ({ module, storage } = await startContext(inject('databaseUrl')));
    commands = module.get(CommandBus);
  });

  afterAll(async () => {
    await module?.close();
  });

  it('reaches the storage port through the bus and answers with a key to upload to', async () => {
    // act
    const presigned: PresignedUpload = await commands.execute(
      new PresignUploadCommand('erize-qeydiyyat.pdf', 'application/pdf', 1024),
    );

    // assert
    expect(presigned.key.value).toContain('erize-qeydiyyat.pdf');
    expect(presigned.url).toBeTruthy();
    expect(presigned.contentType.value).toBe('application/pdf');
    expect(presigned.expiresIn).toBeGreaterThan(0);
  });

  it('refuses a file over the limit before anything is signed', async () => {
    // act / assert — the size is checked in the handler, so an oversized
    // upload never gets a URL it could use
    await expect(
      commands.execute(
        new PresignUploadCommand(
          'huge.pdf',
          'application/pdf',
          FileSize.MAX_BYTES + 1,
        ),
      ),
    ).rejects.toBeInstanceOf(FileTooLargeException);
    expect(storage.objects.size).toBe(0);
  });

  it('refuses a content type the pipeline cannot split', async () => {
    // act / assert
    await expect(
      commands.execute(
        new PresignUploadCommand('notes.txt', 'text/plain', 1024),
      ),
    ).rejects.toThrow();
  });
});
