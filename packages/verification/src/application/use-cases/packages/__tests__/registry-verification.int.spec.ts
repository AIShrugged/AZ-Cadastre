import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import type { AddressLookupResponse } from '@cadastre/api-contracts/registry';

import {
  startContext,
  StubRegistry,
  waitForTerminalStatus,
} from '../../../../../test/context-harness.js';
import type { PackageDetailView } from '../../../read-models/index.js';
import { CreatePackageCommand } from '../create-package/index.js';
import { GetPackageQuery } from '../get-package/index.js';

/*
 * Three papers, because the check needs three: the application the address is
 * read off, the archive certificate that names the owner, and the plan-scheme
 * that carries the cadastral number and the area.
 */
const submission = (prefix: string) =>
  ['erize-qeydiyyat.pdf', 'arxiv-arayisi.pdf', 'plan-sxem.pdf'].map(name => ({
    originalFilename: name,
    contentType: 'application/pdf',
    storageKey: `uploads/${prefix}/${name}`,
  }));

/** The address the offline extractor reads off the demo application. */
const ADDRESS = 'Bakı ş., Nəsimi r., Azadlıq pr. 12, mən. 43';

function answering(
  overrides: Partial<AddressLookupResponse>,
): AddressLookupResponse {
  return {
    outcome: 'Found',
    canonicalAddress: 'Bakı şəhəri, Nəsimi rayonu, Azadlıq prospekti 12',
    record: {
      registerNo: '3-00219',
      inventoryNo: 'İnv-7731',
      address: 'Bakı şəhəri, Nəsimi rayonu, Azadlıq prospekti 12, mənzil 43',
      ownerName: 'Quliyev Rəşad Tofiq oğlu',
      cadastralNumber: 'AZ-CAD-1024-311',
      plotArea: '642 m²',
      location: { folder: '05', pages: '12-dən 38' },
    },
    candidates: 1,
    attributes: [],
    note: 'Register 3-00219 holds this address.',
    ...overrides,
  };
}

/*
 * The whole path, against a real database: a package is submitted, the run
 * reaches the register stage, and what the register said is written down and
 * compiled into the report.
 *
 * Here rather than in a unit test because the check has to survive a write and
 * a read — the stage saves it, `complete()` loads the package again and works
 * the findings out afresh from what was stored (ADR-0009).
 */
describe('a verification run whose register contradicts the package', () => {
  let module: TestingModule;
  let detail: PackageDetailView;
  const registry = new StubRegistry(
    answering({
      // ownerName differs, cadastralNumber agrees, plotArea is not recorded —
      // one of each, so the finding has to pick out the one that matters.
      attributes: [
        {
          name: 'ownerName',
          match: 'Differs',
          submitted: '',
          recorded: 'Quliyev Rəşad Tofiq oğlu',
        },
        {
          name: 'cadastralNumber',
          match: 'Matches',
          submitted: '',
          recorded: 'AZ-CAD-1024-311',
        },
        {
          name: 'plotArea',
          match: 'NotRecorded',
          submitted: '',
          recorded: null,
        },
      ],
    }),
  );

  beforeAll(async () => {
    ({ module } = await startContext(inject('databaseUrl'), { registry }));

    const commands = module.get(CommandBus);
    const queries = module.get(QueryBus);

    const id = await commands.execute(
      new CreatePackageCommand('cadastre', submission('registry-differs')),
    );
    await waitForTerminalStatus(queries, id);
    detail = await queries.execute(new GetPackageQuery(id.value));
  });

  afterAll(async () => {
    await module?.close();
  });

  it('asks the register about the address the application is made under', () => {
    // act / assert
    expect(registry.asked).toEqual([ADDRESS]);
  });

  it('files the disagreement as a finding against the package', () => {
    // act
    const issues = detail.report?.issues ?? [];

    // assert
    expect(issues.map(issue => issue.kind)).toContain('RegistryMismatch');
  });

  it('names the value the record holds, so the inspector sees both sides', () => {
    // act
    const finding = (detail.report?.issues ?? []).find(
      issue => issue.kind === 'RegistryMismatch',
    );

    // assert
    expect(finding?.message).toContain('Quliyev Rəşad Tofiq oğlu');
  });

  // A field the register is silent about is not a disagreement, so it must not
  // appear in the finding beside the one that is.
  it('says nothing about the field the record does not carry', () => {
    // act
    const finding = (detail.report?.issues ?? []).find(
      issue => issue.kind === 'RegistryMismatch',
    );

    // assert
    expect(finding?.message).not.toContain('plotArea');
  });

  it('finishes the package rather than failing it', () => {
    // act / assert
    expect(detail.status).toBe('Completed');
  });
});

describe('a verification run whose register holds no record', () => {
  let module: TestingModule;
  let detail: PackageDetailView;

  beforeAll(async () => {
    ({ module } = await startContext(inject('databaseUrl'), {
      registry: new StubRegistry(
        answering({
          outcome: 'NotFound',
          canonicalAddress: null,
          record: null,
          candidates: 0,
          note: 'No record of this address among the 8 the register holds.',
        }),
      ),
    }));

    const commands = module.get(CommandBus);
    const queries = module.get(QueryBus);

    const id = await commands.execute(
      new CreatePackageCommand('cadastre', submission('registry-absent')),
    );
    await waitForTerminalStatus(queries, id);
    detail = await queries.execute(new GetPackageQuery(id.value));
  });

  afterAll(async () => {
    await module?.close();
  });

  /*
   * The register holds the privatisations of the 1990s and 2000s, not
   * everything that exists. An absence there is not evidence about the
   * submission, so it is stated and never counted against it.
   */
  it('tells the inspector, without calling it a mismatch', () => {
    // act
    const kinds = (detail.report?.issues ?? []).map(issue => issue.kind);

    // assert
    expect(kinds).toContain('RegistryUnconfirmed');
    expect(kinds).not.toContain('RegistryMismatch');
  });
});
