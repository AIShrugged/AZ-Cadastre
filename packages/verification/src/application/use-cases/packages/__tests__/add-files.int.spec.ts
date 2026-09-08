import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import {
  startContext,
  waitForTerminalStatus,
} from '../../../../../test/context-harness.js';
import { PackageNotTakingFilesException } from '../../../../domain/exceptions/index.js';
import {
  Confidence,
  OcrResult,
  PackageStatus,
  RecognisedText,
  type PackageId,
  type PageImage,
} from '../../../../domain/value-objects/index.js';
import { PackageNotFoundException } from '../../../exceptions/index.js';
import {
  OcrProvider,
  VerificationPackageRepository,
} from '../../../ports/outbound/index.js';
import type { PackageDetailView } from '../../../read-models/index.js';
import { AddFilesCommand } from '../add-files/index.js';
import { CreatePackageCommand } from '../create-package/index.js';
import { GetPackageQuery } from '../get-package/index.js';

/*
 * Each storage key is unique across the whole database, so every spec in here
 * works under its own prefix — the same thing the random prefix a presign puts
 * in front does in production.
 */
const aFile = (prefix: string, name: string) => ({
  originalFilename: name,
  contentType: 'application/pdf',
  storageKey: `uploads/${prefix}/${name}`,
});

/**
 * A reader that holds the run where the spec wants it: `asked` settles when the
 * pipeline first offers it a sheet, and nothing comes back until `release()`.
 *
 * That is what makes "while the package is being read" a state a spec can be in
 * rather than a moment it has to race — the offline stages otherwise take a run
 * from start to report in a few milliseconds.
 */
class HeldOcr extends OcrProvider {
  override readonly pagesAtOnce = 8;

  #asked!: () => void;
  #released!: () => void;

  readonly asked = new Promise<void>(resolve => {
    this.#asked = resolve;
  });

  readonly #holding = new Promise<void>(resolve => {
    this.#released = resolve;
  });

  release(): void {
    this.#released();
  }

  async recognise(image: PageImage): Promise<OcrResult> {
    this.#asked();
    await this.#holding;

    return OcrResult.of(
      RecognisedText.of(`SƏNƏD\nİstinad: ${image.storageKey.value}`),
      Confidence.of(0.9),
    );
  }
}

/*
 * What only a real database can answer for: a file arriving at a package whose
 * row is already there, and a report and a register answer being *removed* from
 * it. The write path had never had to delete either — a report was compiled
 * once and the checks were only ever upserted — so this is the set that would
 * catch a discarded report still being served by the read side (ADR-0013).
 */
describe('files added to a package that already exists', () => {
  let module: TestingModule;
  let commands: CommandBus;
  let queries: QueryBus;
  let repository: VerificationPackageRepository;

  const submitAndSettle = async (prefix: string): Promise<PackageId> => {
    const id: PackageId = await commands.execute(
      new CreatePackageCommand('cadastre', [
        aFile(prefix, 'erize-qeydiyyat.pdf'),
      ]),
    );
    await waitForTerminalStatus(queries, id);
    return id;
  };

  const detailOf = async (id: PackageId): Promise<PackageDetailView> =>
    queries.execute(new GetPackageQuery(id.value));

  beforeAll(async () => {
    ({ module } = await startContext(inject('databaseUrl')));
    commands = module.get(CommandBus);
    queries = module.get(QueryBus);
    repository = module.get(VerificationPackageRepository);
  });

  afterAll(async () => {
    await module?.close();
  });

  it('reads the package again with the file that arrived in it', async () => {
    // arrange — a package that has been all the way through the pipeline
    const id = await submitAndSettle('added-run');
    const before = await detailOf(id);

    // act
    await commands.execute(
      new AddFilesCommand(id.value, [
        aFile('added-run', 'sexsiyyet-vesiqe.pdf'),
      ]),
    );
    await waitForTerminalStatus(queries, id);

    // assert — the file that arrived was split, read and segmented like any
    // other
    const after = await detailOf(id);
    expect(before.files).toHaveLength(1);
    expect(after.files.map(file => file.originalFilename).sort()).toEqual([
      'erize-qeydiyyat.pdf',
      'sexsiyyet-vesiqe.pdf',
    ]);
    const arrived = after.files.find(
      file => file.originalFilename === 'sexsiyyet-vesiqe.pdf',
    );
    expect(arrived?.pages).toHaveLength(2);
    expect(arrived?.pages.every(page => page.ocr !== null)).toBe(true);
    expect(arrived?.documents.length).toBeGreaterThan(0);
    expect(after.report).not.toBeNull();
    expect(after.status).toBe(PackageStatus.COMPLETED.value);
  });

  it('leaves the sheets and text of the files that were already there alone', async () => {
    // arrange
    const id = await submitAndSettle('added-keep');
    const before = await detailOf(id);
    const first = before.files[0]!;

    // act
    await commands.execute(
      new AddFilesCommand(id.value, [aFile('added-keep', 'arxiv-arayis.pdf')]),
    );
    await waitForTerminalStatus(queries, id);

    // assert — the same rows, not re-read ones
    const reread = (await detailOf(id)).files.find(
      file => file.id === first.id,
    )!;
    expect(reread.pages.map(page => page.ocr?.text)).toEqual(
      first.pages.map(page => page.ocr?.text),
    );
    expect(reread.documents.map(document => document.id).sort()).toEqual(
      first.documents.map(document => document.id).sort(),
    );
  });

  it('discards the report and the checks it was compiled from, then makes new ones', async () => {
    // arrange — a package with a report, and a run held at the reader so the
    // state right after the file landed can be read rather than raced
    const id = await submitAndSettle('added-report');
    const before = await detailOf(id);
    const held = new HeldOcr();
    const paused = await startContext(inject('databaseUrl'), { ocr: held });

    try {
      // act
      await paused.module
        .get(CommandBus)
        .execute(
          new AddFilesCommand(id.value, [
            aFile('added-report', 'torpaq-plan.pdf'),
          ]),
        );
      await held.asked;

      // assert — nothing worked out over the old envelope is left in the
      // database
      const reopened = await repository.findById(id);
      expect(before.report).not.toBeNull();
      expect(reopened?.report).toBeNull();
      expect(reopened?.crossChecks).toEqual([]);
      expect(reopened?.registryChecks).toEqual([]);
    } finally {
      held.release();
      await waitForTerminalStatus(queries, id);
      await paused.module.close();
    }

    // assert — and a second report is compiled once the fresh run finishes
    expect((await detailOf(id)).report).not.toBeNull();
  });

  it('refuses a file while the run is reading the package, and changes nothing', async () => {
    // arrange — held at the reader, so the package really is under way
    const held = new HeldOcr();
    const paused = await startContext(inject('databaseUrl'), { ocr: held });
    const pausedCommands = paused.module.get(CommandBus);

    try {
      const id: PackageId = await pausedCommands.execute(
        new CreatePackageCommand('cadastre', [
          aFile('added-busy', 'erize-qeydiyyat.pdf'),
        ]),
      );
      await held.asked;

      // act / assert
      await expect(
        pausedCommands.execute(
          new AddFilesCommand(id.value, [
            aFile('added-busy', 'sexsiyyet-vesiqe.pdf'),
          ]),
        ),
      ).rejects.toThrow(PackageNotTakingFilesException);

      held.release();
      await waitForTerminalStatus(queries, id);
      expect((await detailOf(id)).files).toHaveLength(1);
    } finally {
      held.release();
      await paused.module.close();
    }
  });

  it('answers PACKAGE_NOT_FOUND for a package nobody submitted', async () => {
    await expect(
      commands.execute(
        new AddFilesCommand('00000000-0000-4000-8000-000000000000', [
          aFile('added-missing', 'erize-qeydiyyat.pdf'),
        ]),
      ),
    ).rejects.toThrow(PackageNotFoundException);
  });
});
