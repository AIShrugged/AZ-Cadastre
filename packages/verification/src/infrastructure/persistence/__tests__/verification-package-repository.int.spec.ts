import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { ConcurrencyConflictException } from '@cadastre/shared';

import {
  startContext,
  waitForTerminalStatus,
} from '../../../../test/context-harness.js';
import { VerificationPackageRepository } from '../../../application/ports/outbound/index.js';
import { CreatePackageCommand } from '../../../application/use-cases/packages/index.js';
import type { PackageId } from '../../../domain/value-objects/index.js';
import { PackageStatus } from '../../../domain/value-objects/index.js';

/*
 * Two files whose names the offline stages can tell apart. The storage key is
 * unique across the database — that is what the random prefix a presign puts in
 * front is for — so every submission gets its own.
 */
let submissions = 0;
const submission = () => {
  const prefix = `run-${++submissions}`;
  return [
    {
      originalFilename: 'erize-qeydiyyat.pdf',
      contentType: 'application/pdf',
      storageKey: `uploads/${prefix}/erize-qeydiyyat.pdf`,
    },
    {
      originalFilename: 'sexsiyyet-vesiqe.pdf',
      contentType: 'application/pdf',
      storageKey: `uploads/${prefix}/sexsiyyet-vesiqe.pdf`,
    },
  ];
};

describe('VerificationPackageRepositoryAdapter', () => {
  let module: TestingModule;
  let commands: CommandBus;
  let queries: QueryBus;
  let repository: VerificationPackageRepository;

  const submitAndSettle = async (): Promise<PackageId> => {
    const id: PackageId = await commands.execute(
      new CreatePackageCommand('cadastre', submission()),
    );
    await waitForTerminalStatus(queries, id);
    return id;
  };

  beforeAll(async () => {
    ({ module } = await startContext(inject('databaseUrl')));
    commands = module.get(CommandBus);
    queries = module.get(QueryBus);
    repository = module.get(VerificationPackageRepository);
  });

  afterAll(async () => {
    await module?.close();
  });

  it('reads back every part of a finished package the write put there', async () => {
    // arrange
    const id = await submitAndSettle();

    // act
    const reread = await repository.findById(id);

    // assert — files, the pages split off them, and the text read off the pages
    expect(reread).not.toBeNull();
    expect(reread!.id.value).toBe(id.value);
    expect(reread!.files.map(file => file.filename.value).sort()).toEqual([
      'erize-qeydiyyat.pdf',
      'sexsiyyet-vesiqe.pdf',
    ]);
    expect(reread!.files.flatMap(file => [...file.pages]).length).toBe(4);
    expect(
      reread!.files
        .flatMap(file => [...file.pages])
        .every(page => page.ocr !== null),
    ).toBe(true);
  });

  it('reads back the report a finished run compiled', async () => {
    // arrange
    const id = await submitAndSettle();

    // act
    const reread = await repository.findById(id);

    // assert
    expect(reread!.status.value).toBe(PackageStatus.COMPLETED.value);
    expect(reread!.report).not.toBeNull();
    expect(reread!.documents.length).toBeGreaterThan(0);
  });

  it('answers with nothing for an id the database has never seen', async () => {
    // arrange
    const id = await submitAndSettle();
    const missing: PackageId = Object.assign(
      Object.create(Object.getPrototypeOf(id)),
      { value: '00000000-0000-4000-8000-000000000000' },
    );

    // act / assert
    await expect(repository.findById(missing)).resolves.toBeNull();
  });

  it('keeps a re-save of the same package to the rows it already had', async () => {
    // arrange
    const id = await submitAndSettle();
    const loaded = await repository.findById(id);
    const pagesBefore = loaded!.files.flatMap(file => [...file.pages]).length;

    // act
    await repository.save(loaded!);
    const reread = await repository.findById(id);

    // assert — a second write of an unchanged aggregate duplicates nothing
    expect(reread!.files).toHaveLength(2);
    expect(reread!.files.flatMap(file => [...file.pages]).length).toBe(
      pagesBefore,
    );
    expect(reread!.documents.length).toBe(loaded!.documents.length);
  });

  /*
   * Optimistic locking is the one thing here that a unit test cannot see and
   * that fails silently when it is wrong: the update is `WHERE id AND version`,
   * so a second writer that loaded the same row must be refused rather than
   * overwrite what the first one wrote.
   */
  it('refuses the second writer when two use cases loaded the same package', async () => {
    // arrange — two loads of one row, as two requests would get
    const id = await submitAndSettle();
    const first = await repository.findById(id);
    const second = await repository.findById(id);
    expect(first!.version).toBe(second!.version);

    // act
    await repository.save(first!);

    // assert
    await expect(repository.save(second!)).rejects.toBeInstanceOf(
      ConcurrencyConflictException,
    );
  });

  it('moves the version exactly once when a conflicting write is refused', async () => {
    // arrange
    const id = await submitAndSettle();
    const first = await repository.findById(id);
    const second = await repository.findById(id);
    const before = first!.version;

    // act
    await repository.save(first!);
    await expect(repository.save(second!)).rejects.toThrow(
      ConcurrencyConflictException,
    );

    // assert — the refused write left nothing behind
    const reread = await repository.findById(id);
    expect(reread!.version).toBe(before + 1);
    expect(reread!.files).toHaveLength(2);
    expect(reread!.documents.length).toBe(first!.documents.length);
  });
});
