import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import {
  startContext,
  waitForTerminalStatus,
} from '../../../../../test/context-harness.js';
import { ExtractedField } from '../../../../domain/entities/index.js';
import {
  Confidence,
  FieldValue,
  IssueKind,
  PageNumber,
  type PackageId,
} from '../../../../domain/value-objects/index.js';
import {
  FieldExtractor,
  type ExtractionRequest,
} from '../../../ports/outbound/index.js';
import type { PackageDetailView } from '../../../read-models/index.js';
import { CreatePackageCommand } from '../create-package/index.js';
import { GetPackageQuery } from '../get-package/index.js';

const ADDRESS = 'Zığ qəsəbəsi, Əliyev küçəsi 12';

/*
 * The case the customer described: the address is printed on the plan-scheme
 * and read off it, and the sketch design's own address line went unread. The
 * engine used to leave the sketch design's field absent while the answer sat in
 * the same envelope; the gathering stage closes it and says where it came from
 * (ADR-0023).
 *
 * Here and not in a unit test because what is under test is the trip through
 * the database and out through the read model: an origin that survives the
 * aggregate and is lost by a column would tell an inspector a carried-over
 * value was read off the paper it hangs on.
 */
class AnAddressOnThePlanOnly extends FieldExtractor {
  override async extract(
    request: ExtractionRequest,
  ): Promise<readonly ExtractedField[]> {
    const of = (key: string, value: string): ExtractedField =>
      ExtractedField.of(
        request.spec.schema.specs.find(spec => spec.key.value === key)!.key,
        FieldValue.create(value),
        Confidence.of(0.9),
        PageNumber.first(),
      );

    if (request.spec.type.value === 'land_plot_plan') {
      return [of('property_address', ADDRESS)];
    }
    if (request.spec.type.value === 'sketch_project') {
      return [of('project_name', 'Fərdi yaşayış evi')];
    }

    return [];
  }
}

// Two files the offline classifier can tell apart by their headings: the
// plan-scheme and the sketch design.
let submissions = 0;
const submission = () => {
  const prefix = `gathered-${++submissions}`;

  return [
    {
      originalFilename: 'plan-sxem.pdf',
      contentType: 'application/pdf',
      storageKey: `uploads/${prefix}/plan-sxem.pdf`,
    },
    {
      originalFilename: 'eskiz-layihe.pdf',
      contentType: 'application/pdf',
      storageKey: `uploads/${prefix}/eskiz-layihe.pdf`,
    },
  ];
};

describe('a field one paper did not yield and another states', () => {
  let module: TestingModule;
  let detail: PackageDetailView;
  let id: PackageId;

  beforeAll(async () => {
    ({ module } = await startContext(inject('databaseUrl'), {
      extractor: new AnAddressOnThePlanOnly(),
    }));

    const commands = module.get(CommandBus);
    const queries = module.get(QueryBus);

    id = await commands.execute(
      new CreatePackageCommand('cadastre', submission()),
    );
    await waitForTerminalStatus(queries, id);
    detail = await queries.execute(new GetPackageQuery(id.value));
  });

  afterAll(async () => {
    await module?.close();
  });

  const documentOf = (type: string) =>
    detail.files
      .flatMap(file => [...file.documents])
      .find(document => document.type === type);

  const fieldOn = (type: string, name: string) =>
    documentOf(type)?.fields.find(field => field.name === name);

  it('reads the address off the paper that prints it', () => {
    // act / assert
    const read = fieldOn('land_plot_plan', 'property_address');

    expect(read?.value).toBe(ADDRESS);
    expect(read?.origin).toBe('ReadOnThisDocument');
    expect(read?.pageNumber).toBe(1);
    expect(read?.takenFrom).toBeNull();
  });

  it('closes the field on the paper that did not, out of the same package', () => {
    // act / assert
    expect(fieldOn('sketch_project', 'property_address')?.value).toBe(ADDRESS);
  });

  it('publishes it as a value that paper did not yield, and names the one that did', () => {
    // act
    const carried = fieldOn('sketch_project', 'property_address');

    // assert
    expect(carried?.origin).toBe('TakenFromAnotherDocument');
    expect(carried?.takenFrom?.documentId).toBe(
      documentOf('land_plot_plan')?.id,
    );
    expect(carried?.takenFrom?.documentType).toBe('land_plot_plan');
    expect(carried?.takenFrom?.fieldName).toBe('property_address');
    expect(carried?.takenFrom?.pageNumber).toBe(1);
  });

  /*
   * A client turns `pageNumber` into a sheet of the document the field hangs
   * on. This document has no sheet that states the value, so it publishes none
   * — a foreign number here would open the wrong paper.
   */
  it('cites no sheet of the paper it was carried to', () => {
    // act / assert
    expect(
      fieldOn('sketch_project', 'property_address')?.pageNumber,
    ).toBeNull();
  });

  it('is never surer than the reading it was copied from', () => {
    // act
    const read = fieldOn('land_plot_plan', 'property_address');
    const carried = fieldOn('sketch_project', 'property_address');

    // assert
    expect(carried!.confidence).toBeLessThan(read!.confidence);
  });

  // The finding is about a reading, and there is one reading — reported against
  // the paper it was made on. A second copy against the paper that did not
  // yield it would send the inspector to a page with nothing to look at.
  it('is not reported as a reading anybody doubted', () => {
    // act
    const doubted = (detail.report?.issues ?? []).filter(
      issue =>
        issue.kind === IssueKind.LOW_CONFIDENCE.value &&
        issue.documentId === documentOf('sketch_project')?.id &&
        issue.fieldName === 'property_address',
    );

    // assert
    expect(doubted).toEqual([]);
  });

  // The field the package says nothing about anywhere stays absent: closing it
  // would mean inventing a value, which is the one thing this must never do.
  it('leaves a field the package states nowhere absent', () => {
    // act / assert
    expect(fieldOn('sketch_project', 'total_area')).toBeUndefined();
  });

  /*
   * The same answer for the keys the two drawings gained from the acceptance
   * contract, and the whole way out through the read model: a paper that does
   * not print an easement, a set of turning points or a QR reference yields no
   * value, and the client is shown nothing rather than a blank string that
   * reads as a value somebody wrote down.
   */
  it('leaves a field the contract added and the paper did not yield absent', () => {
    // act / assert
    for (const name of ['easements', 'turning_points', 'qr_code']) {
      expect(fieldOn('land_plot_plan', name)).toBeUndefined();
    }
    for (const name of ['built_up_area', 'datum_level', 'sheet_count']) {
      expect(fieldOn('sketch_project', name)).toBeUndefined();
    }
  });

  // The gathering stage carries what a check maps and nothing else. The sketch
  // design gained twelve keys and none of them is in a check, so the address
  // is still the only value that arrives from another paper.
  it('carries the address and nothing the contract added', () => {
    // act
    const carried = (documentOf('sketch_project')?.fields ?? []).filter(
      field => field.origin === 'TakenFromAnotherDocument',
    );

    // assert
    expect(carried.map(field => field.name)).toEqual(['property_address']);
  });
});
