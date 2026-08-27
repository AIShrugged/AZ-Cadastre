import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import {
  startContext,
  UnreadableOcr,
  waitForTerminalStatus,
} from '../../../../../test/context-harness.js';
import type { PackageId } from '../../../../domain/value-objects/index.js';
import { PackageStatus } from '../../../../domain/value-objects/index.js';
import type { PackageDetailView } from '../../../read-models/index.js';
import { CreatePackageCommand } from '../create-package/index.js';
import { GetPackageQuery } from '../get-package/index.js';

const submission = (prefix: string) => [
  {
    originalFilename: 'erize-qeydiyyat.pdf',
    contentType: 'application/pdf',
    storageKey: `uploads/${prefix}/erize-qeydiyyat.pdf`,
  },
];

/*
 * A provider that refuses is the normal case, not the exceptional one: rate
 * limits and timeouts have nothing to do with the sheet in hand. The stage
 * answers that with a per-sheet retry budget and then gives up on the sheet,
 * and the run carries the gap through to the report rather than stopping.
 *
 * What proves it is the rows the run left behind, which is why this is here and
 * not in a unit test — and the attempt count, which is the only place the
 * budget is observable at all.
 */
describe('a verification run whose reader never succeeds', () => {
  let module: TestingModule;
  let detail: PackageDetailView;
  let id: PackageId;
  const ocr = new UnreadableOcr();

  /** Two sheets off the one submitted file, by FixedPageSplitter. */
  const SHEETS = 2;
  /** ATTEMPTS_PER_SHEET in the run handler. */
  const ATTEMPTS = 3;

  beforeAll(async () => {
    ({ module } = await startContext(inject('databaseUrl'), { ocr }));

    const commands = module.get(CommandBus);
    const queries = module.get(QueryBus);

    id = await commands.execute(
      new CreatePackageCommand('cadastre', submission('unreadable')),
    );
    await waitForTerminalStatus(queries, id);
    detail = await queries.execute(new GetPackageQuery(id.value));
  });

  afterAll(async () => {
    await module?.close();
  });

  it('finishes the package rather than failing it', () => {
    // act / assert
    expect(detail.status).toBe(PackageStatus.COMPLETED.value);
  });

  it('gives each sheet the retry budget and then gives up on it', () => {
    // act / assert — not more, or a dead provider costs the run forever; not
    // fewer, or a provider having a bad second costs it a sheet
    expect(ocr.attempts).toBe(SHEETS * ATTEMPTS);
  });

  it('keeps the sheets it could not read, with nothing read off them', () => {
    // act
    const pages = detail.files.flatMap(file => [...file.pages]);

    // assert — the sheets are on record; what is missing is the reading
    expect(pages).toHaveLength(SHEETS);
    expect(pages.every(page => page.ocr === null)).toBe(true);
  });

  it('still compiles a report, and it does not claim the package is fine', () => {
    // act / assert
    expect(detail.report).not.toBeNull();
    expect(detail.report!.status).not.toBe('OK');
    expect(detail.report!.issues.length).toBeGreaterThan(0);
  });
});
