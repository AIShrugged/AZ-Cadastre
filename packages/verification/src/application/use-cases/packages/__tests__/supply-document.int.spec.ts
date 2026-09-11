import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import {
  startContext,
  waitForTerminalStatus,
} from '../../../../../test/context-harness.js';
import { ExtractedField } from '../../../../domain/entities/index.js';
import { NoSuchDocumentGapException } from '../../../../domain/exceptions/index.js';
import {
  Confidence,
  FieldValue,
  PageNumber,
  type PackageId,
} from '../../../../domain/value-objects/index.js';
import {
  FieldExtractor,
  type ExtractionRequest,
} from '../../../ports/outbound/index.js';
import type {
  DocumentGapView,
  PackageDetailView,
} from '../../../read-models/index.js';
import { CreatePackageCommand } from '../create-package/index.js';
import { GetPackageQuery } from '../get-package/index.js';
import { SupplyDocumentCommand } from '../supply-document/index.js';

/*
 * A document sent in for one of the holes the package publishes (COMM-80).
 *
 * Here and not in a unit test because three of the four things under test only
 * exist once the database and the read side are in it: the gaps are worked out
 * by the detail query off rows rather than by the aggregate, the replacement
 * has to survive a round trip through two columns and a self-reference, and
 * "the whole path runs on the supplied document" is a statement about the
 * pipeline the event handler starts, not about the aggregate.
 */

/*
 * A reader that leaves the identity card short of one field.
 *
 * The offline extractor answers every field of every schema, which is a package
 * with no gaps in it at all — so a spec about a scan the package will take
 * again has to bring a reader that leaves one. Everything else reads cleanly,
 * because a second bad scan would be a second gap and the specs below count
 * them.
 */
class ACardWithoutItsNumber extends FieldExtractor {
  override async extract(
    request: ExtractionRequest,
  ): Promise<readonly ExtractedField[]> {
    const asked = request.spec.schema.specs;
    const unread =
      request.spec.type.value === 'identity_card' ? 'document_no' : null;

    return asked
      .filter(spec => spec.key.value !== unread)
      .map(spec =>
        ExtractedField.of(
          spec.key,
          FieldValue.create(`${spec.key.value}-value`),
          Confidence.of(0.95),
          PageNumber.first(),
        ),
      );
  }
}

// Each storage key is unique across the whole database, so every spec in here
// works under its own prefix — the same thing the random prefix a presign puts
// in front does in production.
const aFile = (prefix: string, name: string) => ({
  originalFilename: name,
  contentType: 'application/pdf',
  storageKey: `uploads/${prefix}/${name}`,
});

function gapsFor(
  detail: PackageDetailView,
  expectedType: string,
): readonly DocumentGapView[] {
  return detail.gaps.filter(gap => gap.expectedType === expectedType);
}

describe('a document supplied for a gap the package publishes', () => {
  let module: TestingModule;
  let commands: CommandBus;
  let queries: QueryBus;

  // A package carrying an application and an identity card whose number went
  // unread: one required paper short of nothing, one scan worth sending again.
  const submitAndSettle = async (prefix: string): Promise<PackageId> => {
    const id: PackageId = await commands.execute(
      new CreatePackageCommand('cadastre', [
        aFile(prefix, 'erize-qeydiyyat.pdf'),
        aFile(prefix, 'sexsiyyet-vesiqe.pdf'),
      ]),
    );
    await waitForTerminalStatus(queries, id);
    return id;
  };

  const detailOf = async (id: PackageId): Promise<PackageDetailView> =>
    queries.execute(new GetPackageQuery(id.value));

  beforeAll(async () => {
    ({ module } = await startContext(inject('databaseUrl'), {
      extractor: new ACardWithoutItsNumber(),
    }));
    commands = module.get(CommandBus);
    queries = module.get(QueryBus);
  });

  afterAll(async () => {
    await module?.close();
  });

  describe('what the detail response publishes', () => {
    it('offers the required papers that are not here, naming no document', async () => {
      const detail = await detailOf(await submitAndSettle('gaps-missing'));

      const [missing] = gapsFor(detail, 'archive_certificate');
      expect(missing?.reason).toBe('MissingDocument');
      expect(missing?.documentId).toBeNull();
    });

    it('offers the scan it read badly, naming the document and its file', async () => {
      const detail = await detailOf(await submitAndSettle('gaps-scan'));

      const [scan] = gapsFor(detail, 'identity_card');
      const card = detail.files
        .flatMap(file => file.documents.map(document => ({ file, document })))
        .find(one => one.document.type === 'identity_card');

      expect(scan?.reason).toBe('UnusableScan');
      expect(scan?.documentId).toBe(card?.document.id);
      expect(scan?.sourceFileId).toBe(card?.file.id);
    });

    // Nothing was read badly about the application, and nothing is offered
    // about it: the rule the server publishes is the rule it enforces.
    it('says nothing about a paper that is here and read cleanly', async () => {
      const detail = await detailOf(await submitAndSettle('gaps-clean'));

      expect(gapsFor(detail, 'application')).toEqual([]);
    });
  });

  describe('when what arrived is what was asked for', () => {
    it('runs the whole path over it and closes the gap it was sent for', async () => {
      // arrange — a package short of the order that allotted the parcel
      const id = await submitAndSettle('supply-missing');
      const before = await detailOf(id);
      expect(gapsFor(before, 'disposal_order')).toHaveLength(1);

      // act
      await commands.execute(
        new SupplyDocumentCommand(
          id.value,
          aFile('supply-missing', 'serencam-cixaris.pdf'),
          'disposal_order',
          null,
        ),
      );
      await waitForTerminalStatus(queries, id);

      // assert — read, placed, its fields extracted, and the report compiled
      // afresh without the finding it was sent to answer
      const after = await detailOf(id);
      const arrived = after.files.find(
        file => file.originalFilename === 'serencam-cixaris.pdf',
      );
      expect(arrived?.suppliedFor).toEqual({
        expectedType: 'disposal_order',
        replacesDocumentId: null,
      });
      expect(
        arrived?.documents.some(document => document.fields.length > 0),
      ).toBe(true);
      expect(gapsFor(after, 'disposal_order')).toEqual([]);
      expect(
        after.report?.issues.some(
          issue =>
            issue.kind === 'MissingDocument' &&
            issue.documentType === 'disposal_order',
        ),
      ).toBe(false);
    });

    it('puts the replaced scan out of force and keeps it in the package', async () => {
      // arrange — the identity card whose number went unread
      const id = await submitAndSettle('supply-replace');
      const [gap] = gapsFor(await detailOf(id), 'identity_card');

      // act
      await commands.execute(
        new SupplyDocumentCommand(
          id.value,
          aFile('supply-replace', 'sexsiyyet-vesiqe-yeni.pdf'),
          'identity_card',
          gap!.documentId,
        ),
      );
      await waitForTerminalStatus(queries, id);

      // assert — the old document is still here, marked with what replaced it
      const after = await detailOf(id);
      const documents = after.files.flatMap(file => file.documents);
      const replaced = documents.find(one => one.id === gap!.documentId);
      const replacement = after.files
        .find(file => file.originalFilename === 'sexsiyyet-vesiqe-yeni.pdf')
        ?.documents.find(one => one.type === 'identity_card');

      expect(replaced).toBeDefined();
      expect(replaced?.supersededById).toBe(replacement?.id);
      expect(replaced?.supersededAt).not.toBeNull();
    });

    /*
     * The replaced scan is history: nothing the package states is worked out
     * from it.
     *
     * The reader in this set leaves every identity card short of its number, so
     * the replacement is a scan the package would take again too — which is the
     * sharper test of the same thing. The offer has moved to the paper in
     * force, the replaced one is not offered any more, and it is not a second
     * identity card in the report.
     */
    it('compiles the report from the paper in force', async () => {
      const id = await submitAndSettle('supply-report');
      const [gap] = gapsFor(await detailOf(id), 'identity_card');

      await commands.execute(
        new SupplyDocumentCommand(
          id.value,
          aFile('supply-report', 'sexsiyyet-vesiqe-yeni.pdf'),
          'identity_card',
          gap!.documentId,
        ),
      );
      await waitForTerminalStatus(queries, id);

      const after = await detailOf(id);
      const replacement = after.files
        .find(file => file.originalFilename === 'sexsiyyet-vesiqe-yeni.pdf')
        ?.documents.find(one => one.type === 'identity_card');

      expect(
        gapsFor(after, 'identity_card').map(one => one.documentId),
      ).toEqual([replacement?.id]);
      expect(
        after.report?.issues.some(issue => issue.kind === 'DuplicateDocument'),
      ).toBe(false);
      expect(
        after.report?.issues.some(
          issue => issue.documentId === gap!.documentId,
        ),
      ).toBe(false);
    });
  });

  describe('when what arrived is not what was asked for', () => {
    it('refuses it in the report and leaves the gap open', async () => {
      // arrange — a package short of the plan-scheme
      const id = await submitAndSettle('supply-wrong');

      // act — and the operator attaches the identity card instead
      await commands.execute(
        new SupplyDocumentCommand(
          id.value,
          aFile('supply-wrong', 'sexsiyyet-vesiqe-again.pdf'),
          'land_plot_plan',
          null,
        ),
      );
      await waitForTerminalStatus(queries, id);

      // assert — said plainly, and the paper the package still needs is still
      // offered
      const after = await detailOf(id);
      const [refusal] = (after.report?.issues ?? []).filter(
        issue => issue.kind === 'WrongDocumentSupplied',
      );

      expect(refusal?.documentType).toBe('land_plot_plan');
      expect(refusal?.message).toContain('sexsiyyet-vesiqe-again.pdf');
      expect(gapsFor(after, 'land_plot_plan')).toHaveLength(1);
    });
  });

  // The published list and the accepted call are one list, and this is where
  // that holds or does not: a screen drawing its buttons off `gaps` must never
  // meet a refusal here.
  it('refuses a file sent in for something it is not short of', async () => {
    const id = await submitAndSettle('supply-nogap');

    await expect(
      commands.execute(
        new SupplyDocumentCommand(
          id.value,
          aFile('supply-nogap', 'erize-qeydiyyat-again.pdf'),
          'application',
          null,
        ),
      ),
    ).rejects.toBeInstanceOf(NoSuchDocumentGapException);

    // And nothing was taken in: a refusal must not leave a package that has
    // discarded its report over a file it declined.
    const after = await detailOf(id);
    expect(after.files).toHaveLength(2);
    expect(after.report).not.toBeNull();
  });
});
