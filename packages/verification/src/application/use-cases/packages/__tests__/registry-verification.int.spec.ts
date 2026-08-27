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
  [
    'erize-qeydiyyat.pdf',
    'arxiv-arayisi.pdf',
    'plan-sxem.pdf',
    'serencamdan-cixaris.pdf',
  ].map(name => ({
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
      documents: [],
    },
    candidates: 1,
    attributes: [],
    documents: [],
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

  /*
   * The check itself, and not only the finding compiled out of it: a register
   * that confirms produces no finding at all, so a read side carrying findings
   * alone would report a stage nobody could tell had run (ADR-0009). It is what
   * the surface shows the inspector.
   */
  it('carries the answer whole into the detail view, with the archive locator', () => {
    // act
    const check = detail.registryChecks[0];

    // assert
    expect(detail.registryChecks).toHaveLength(1);
    expect(check).toMatchObject({
      key: 'property_of_record',
      outcome: 'Differs',
      reference: 'folder 05, pp. 12-dən 38',
    });
    expect(check?.asked.value).toBe(ADDRESS);
  });

  it('carries every attribute the record was held against, the silent one included', () => {
    // act
    const attributes = detail.registryChecks[0]?.attributes ?? [];

    // assert — in the order the profile names them
    expect(
      attributes.map(attribute => [
        attribute.name,
        attribute.agrees,
        attribute.recorded,
      ]),
    ).toEqual([
      ['ownerName', false, 'Quliyev Rəşad Tofiq oğlu'],
      ['cadastralNumber', true, 'AZ-CAD-1024-311'],
      ['plotArea', false, null],
    ]);
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

  // Asked, answered, nothing found: the check still stands in the detail view,
  // because "the register was asked and holds nothing" is the answer. There is
  // no locator, and nothing was held against anything — every attribute came
  // back silent.
  it('records the lookup as a check with no record behind it', () => {
    // act
    const check = detail.registryChecks[0];

    // assert
    expect(check).toMatchObject({ outcome: 'NotFound', reference: null });
    expect(
      check?.attributes.every(attribute => attribute.recorded === null),
    ).toBe(true);
  });
});

/*
 * The third of the answers a register can give about a property it does hold:
 * the record agrees with the package, and the archive has no original of one of
 * the papers the submission rests on.
 *
 * It is a finding and not an observation, unlike an absent record. The archive's
 * silence about a kind of paper never reaches here — only a register that wrote
 * down the absence does — and for a title relied on under Decree 439 the
 * original in the National Archive Fund is a condition of the ground being
 * valid, not a nicety (§7, ADR-0010).
 */
describe('a verification run whose archive is short one of the papers', () => {
  let module: TestingModule;
  let detail: PackageDetailView;
  const registry = new StubRegistry(
    answering({
      documents: [
        {
          name: 'Ərizə',
          type: 'application',
          holding: 'Held',
          number: '1126012493',
          issuedOn: '28.01.2026',
          location: { folder: '05', pages: '12-dən 38' },
        },
        // The one the archive recorded that it does not have.
        {
          name: 'Sərəncam çıxarışı',
          type: 'disposal_order',
          holding: 'NotHeld',
          number: null,
          issuedOn: null,
          location: null,
        },
        // And one its register never had a column for, which must not be
        // reported as missing beside the one that is.
        {
          name: 'Arayış',
          type: 'archive_certificate',
          holding: 'Unknown',
          number: null,
          issuedOn: null,
          location: null,
        },
      ],
    }),
  );

  beforeAll(async () => {
    ({ module } = await startContext(inject('databaseUrl'), { registry }));

    const commands = module.get(CommandBus);
    const queries = module.get(QueryBus);

    const id = await commands.execute(
      new CreatePackageCommand('cadastre', submission('registry-short')),
    );
    await waitForTerminalStatus(queries, id);
    detail = await queries.execute(new GetPackageQuery(id.value));
  });

  afterAll(async () => {
    await module?.close();
  });

  it("asks the archive about the papers in the register's own words", () => {
    // act / assert — and only about the ones the package actually carries
    expect(registry.askedFor).toEqual([
      ['Ərizə', 'Sərəncam çıxarışı', 'Arayış'],
    ]);
  });

  it('records the check as incomplete rather than as a contradiction', () => {
    // act
    const check = detail.registryChecks[0];

    // assert
    expect(check?.outcome).toBe('Incomplete');
  });

  it('files one finding, against the paper whose original is not there', () => {
    // act
    const findings = (detail.report?.issues ?? []).filter(
      issue => issue.kind === 'RegistryDocumentMissing',
    );

    // assert
    expect(findings).toHaveLength(1);
    expect(findings[0]?.documentType).toBe('disposal_order');
    expect(findings[0]?.message).toContain('Sərəncam çıxarışı');
  });

  // Silence is not absence: a column that area's register never kept must not
  // reach the report as a paper the archive lost.
  it('says nothing about the paper its register never had a column for', () => {
    // act
    const findings = (detail.report?.issues ?? []).filter(
      issue => issue.kind === 'RegistryDocumentMissing',
    );

    // assert
    expect(findings.some(finding => finding.message.includes('Arayış'))).toBe(
      false,
    );
  });

  // The record agreed. Calling it a mismatch would send the inspector looking
  // for a disagreement that is not there.
  it('does not call it a mismatch', () => {
    // act
    const kinds = (detail.report?.issues ?? []).map(issue => issue.kind);

    // assert
    expect(kinds).not.toContain('RegistryMismatch');
  });

  /*
   * The check whole, not only the finding compiled out of it: an inspector
   * looking at the archive block sees which papers are in the file and which
   * are not, and the two the archive has are what they do not have to look up.
   */
  it('carries every paper it asked about into the detail view', () => {
    // act
    const documents = detail.registryChecks[0]?.documents ?? [];

    // assert — in the order the profile names them
    expect(
      documents.map(document => [document.documentType, document.holding]),
    ).toEqual([
      ['application', 'Held'],
      ['disposal_order', 'NotHeld'],
      ['archive_certificate', 'Unknown'],
    ]);
  });

  it('finishes the package rather than failing it', () => {
    // act / assert
    expect(detail.status).toBe('Completed');
  });
});
