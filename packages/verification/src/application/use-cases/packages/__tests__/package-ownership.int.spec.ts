import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { LIST_PACKAGES_MAX_LIMIT } from '@cadastre/api-contracts/verification';

import { startContext } from '../../../../../test/context-harness.js';
import type { PackageId } from '../../../../domain/value-objects/index.js';
import { PackageNotFoundException } from '../../../exceptions/index.js';
import { AddFilesCommand } from '../add-files/index.js';
import { CreatePackageCommand } from '../create-package/index.js';
import { GetPackageQuery } from '../get-package/index.js';
import { ListPackagesQuery } from '../list-packages/index.js';

const MINE = '22222222-2222-4222-8222-222222222222';
const THEIRS = '33333333-3333-4333-8333-333333333333';

let filed = 0;
const submission = () => {
  const prefix = `own-${++filed}`;

  return [
    {
      originalFilename: 'erize-qeydiyyat.pdf',
      contentType: 'application/pdf',
      storageKey: `uploads/${prefix}/erize-qeydiyyat.pdf`,
    },
  ];
};

let module: TestingModule;
let commands: CommandBus;
let queries: QueryBus;

let mine: PackageId;
let theirs: PackageId;
let unowned: PackageId;

const listFor = (owner: string | null) =>
  new ListPackagesQuery(
    undefined,
    undefined,
    undefined,
    LIST_PACKAGES_MAX_LIMIT,
    0,
    owner,
  );

/*
 * Who may see and touch which submission, put to a real database (ADR-0029).
 *
 * The scope is part of the SQL rather than a check made after the row came
 * back, so it is only really proved where the SQL runs: a unit test over a fake
 * repository proves the use case remembered to pass the scope, and this proves
 * the column narrows the answer.
 */
beforeAll(async () => {
  ({ module } = await startContext(inject('databaseUrl')));
  commands = module.get(CommandBus);
  queries = module.get(QueryBus);

  mine = await commands.execute(
    new CreatePackageCommand('cadastre', submission(), {}, MINE),
  );
  theirs = await commands.execute(
    new CreatePackageCommand('cadastre', submission(), {}, THEIRS),
  );
  // No owner: what every submission taken in before accounts existed looks
  // like, and what the migration left behind.
  unowned = await commands.execute(
    new CreatePackageCommand('cadastre', submission(), {}, null),
  );
});

afterAll(async () => {
  await module?.close();
});

describe('the register of cases, read by an applicant', () => {
  it('holds only their own submissions', async () => {
    const page = await queries.execute(listFor(MINE));
    const ids = page.items.map(item => item.id);

    expect(ids).toContain(mine.value);
    expect(ids).not.toContain(theirs.value);
    expect(ids).not.toContain(unowned.value);
  });

  it('counts what it listed, so a pager over it adds up', async () => {
    const page = await queries.execute(listFor(MINE));

    expect(page.total).toBe(page.items.length);
  });
});

describe('the register of cases, read by the office', () => {
  it('holds every submission, owned or not', async () => {
    const page = await queries.execute(listFor(null));
    const ids = page.items.map(item => item.id);

    expect(ids).toEqual(
      expect.arrayContaining([mine.value, theirs.value, unowned.value]),
    );
  });
});

describe('one submission', () => {
  it('opens for its owner', async () => {
    const detail = await queries.execute(new GetPackageQuery(mine.value, MINE));

    expect(detail.id).toBe(mine.value);
  });

  it('is not there for anybody else — a 404 and never a 403', async () => {
    await expect(
      queries.execute(new GetPackageQuery(theirs.value, MINE)),
    ).rejects.toBeInstanceOf(PackageNotFoundException);
  });

  it('is not there for an applicant when it has no owner', async () => {
    await expect(
      queries.execute(new GetPackageQuery(unowned.value, MINE)),
    ).rejects.toBeInstanceOf(PackageNotFoundException);
  });

  it('opens for the office whoever filed it', async () => {
    await expect(
      queries.execute(new GetPackageQuery(theirs.value, null)),
    ).resolves.toMatchObject({ id: theirs.value });
    await expect(
      queries.execute(new GetPackageQuery(unowned.value, null)),
    ).resolves.toMatchObject({ id: unowned.value });
  });

  it('takes no files from anybody but its owner', async () => {
    await expect(
      commands.execute(new AddFilesCommand(theirs.value, submission(), MINE)),
    ).rejects.toBeInstanceOf(PackageNotFoundException);
  });
});
