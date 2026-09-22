import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import {
  ACountingCrossChecker,
  startContext,
  waitForTerminalStatus,
} from '../../../../../test/context-harness.js';
import { ExtractedField } from '../../../../domain/entities/index.js';
import { PackageNotTakingFilesException } from '../../../../domain/exceptions/index.js';
import {
  Confidence,
  FieldValue,
  OcrResult,
  PackageStatus,
  PageNumber,
  RecognisedText,
  type PackageId,
  type PageImage,
} from '../../../../domain/value-objects/index.js';
import {
  FieldExtractor,
  OcrProvider,
  type ExtractionRequest,
} from '../../../ports/outbound/index.js';
import type {
  DocumentView,
  FieldView,
  PackageDetailView,
} from '../../../read-models/index.js';
import { AddFilesCommand } from '../add-files/index.js';
import { ApproveArchiveSearchCommand } from '../approve-archive-search/index.js';
import { CreatePackageCommand } from '../create-package/index.js';
import { EditDocumentFieldsCommand } from '../edit-document-fields/index.js';
import { GetPackageQuery } from '../get-package/index.js';

/*
 * An operator corrects a field the pipeline read badly, and the package is
 * verified again from the stage the correction reaches (ADR-0033).
 *
 * Here and not only in a unit test because most of what is under test only
 * exists once the database and the read side are in it: a field row has to be
 * *deleted* rather than upserted when a value is struck out or a source is
 * lost, the fourth origin and the two audit columns have to survive a round
 * trip, and "the checks that could change are made again" is a statement about
 * the run the event handler starts, not about the aggregate.
 */

const AS_READ = 'AZE0000000';
const AS_THE_OPERATOR_READS_IT = 'AZE1234567';
const ADDRESS_ON_THE_PLAN = 'Zığ qəsəbəsi, Əliyev küçəsi 12';
const OPERATOR = '0190a1b2-c3d4-7e5f-8a9b-0000000000aa';

/*
 * A reader that misreads the identity card's number and gets the application's
 * copy of it right.
 *
 * The offline extractor answers every field of every schema alike, which is a
 * package whose cross-checks all agree — so a spec about a check that *fails*
 * and is then made to pass has to bring a reader that gets one value wrong.
 */
class AMisreadCardNumber extends FieldExtractor {
  override async extract(
    request: ExtractionRequest,
  ): Promise<readonly ExtractedField[]> {
    const type = request.spec.type.value;

    return request.spec.schema.specs.map(spec =>
      ExtractedField.of(
        spec.key,
        FieldValue.create(valueFor(type, spec.key.value)),
        Confidence.of(0.95),
        PageNumber.first(),
      ),
    );
  }
}

function valueFor(type: string, key: string): string {
  if (type === 'identity_card' && key === 'document_no') return AS_READ;
  if (key === 'applicant_document_no') return AS_THE_OPERATOR_READS_IT;

  return `${key}-value`;
}

/**
 * A reader that leaves the sketch design without an address and prints one on
 * the plan-scheme, so the sketch design's field is closed by gathering — the
 * case a correction to the *source* of a carried-over value has to reach.
 */
class AnAddressOnThePlanOnly extends FieldExtractor {
  override async extract(
    request: ExtractionRequest,
  ): Promise<readonly ExtractedField[]> {
    const type = request.spec.type.value;
    const unread = type === 'sketch_project' ? 'property_address' : null;

    return request.spec.schema.specs
      .filter(spec => spec.key.value !== unread)
      .map(spec =>
        ExtractedField.of(
          spec.key,
          FieldValue.create(
            spec.key.value === 'property_address'
              ? ADDRESS_ON_THE_PLAN
              : `${spec.key.value}-value`,
          ),
          Confidence.of(0.95),
          PageNumber.first(),
        ),
      );
  }
}

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

// Each storage key is unique across the whole database, so every spec in here
// works under its own prefix — the same thing the random prefix a presign puts
// in front does in production.
const aFile = (prefix: string, name: string) => ({
  originalFilename: name,
  contentType: 'application/pdf',
  storageKey: `uploads/${prefix}/${name}`,
});

function documentOf(
  detail: PackageDetailView,
  type: string,
): DocumentView | undefined {
  return detail.files
    .flatMap(file => [...file.documents])
    .find(document => document.type === type);
}

function fieldOn(
  detail: PackageDetailView,
  type: string,
  name: string,
): FieldView | undefined {
  return documentOf(detail, type)?.fields.find(field => field.name === name);
}

describe('a field an operator corrects by hand', () => {
  let module: TestingModule;
  let commands: CommandBus;
  let queries: QueryBus;

  const detailOf = async (id: PackageId): Promise<PackageDetailView> =>
    queries.execute(new GetPackageQuery(id.value, null));

  beforeAll(async () => {
    ({ module } = await startContext(inject('databaseUrl'), {
      extractor: new AMisreadCardNumber(),
    }));
    commands = module.get(CommandBus);
    queries = module.get(QueryBus);
  });

  afterAll(async () => {
    await module?.close();
  });

  async function submitAndSettle(prefix: string): Promise<PackageId> {
    const id: PackageId = await commands.execute(
      new CreatePackageCommand('cadastre', [
        aFile(prefix, 'sexsiyyet-vesiqe.pdf'),
        aFile(prefix, 'erize-qeydiyyat.pdf'),
      ]),
    );
    await waitForTerminalStatus(queries, id);

    return id;
  }

  async function corrected(prefix: string) {
    const id = await submitAndSettle(prefix);
    const before = await detailOf(id);
    const card = documentOf(before, 'identity_card')!;

    await commands.execute(
      new EditDocumentFieldsCommand(
        id.value,
        card.id,
        [{ name: 'document_no', value: AS_THE_OPERATOR_READS_IT }],
        OPERATOR,
      ),
    );
    await waitForTerminalStatus(queries, id);

    return { id, card, before, after: await detailOf(id) };
  }

  const verdictOf = (detail: PackageDetailView, key: string) =>
    detail.crossChecks.find(check => check.key === key)?.verdict;

  it('makes the cross-check that failed on the misreading agree', async () => {
    // arrange / act
    const { before, after } = await corrected('corrected-check');

    // assert — the readings disagreed, and the same check now matches
    expect(verdictOf(before, 'identity_document_no')).toBe('Mismatch');
    expect(verdictOf(after, 'identity_document_no')).toBe('Match');
  });

  it("publishes the value as the operator's own, certain, and audited", async () => {
    // arrange / act
    const { after } = await corrected('corrected-origin');

    // assert
    const field = fieldOn(after, 'identity_card', 'document_no');
    expect(field?.value).toBe(AS_THE_OPERATOR_READS_IT);
    expect(field?.origin).toBe('EnteredByOperator');
    expect(field?.confidence).toBe(1);
    expect(field?.editedByAccountId).toBe(OPERATOR);
    expect(field?.editedAt).toBeInstanceOf(Date);
  });

  /*
   * The extraction stage re-reads a paper it has no machine reading for, and
   * what it reads must not write over the correction. A person correcting a
   * value and the machine putting its own back on the next run is the one
   * failure that would make the whole feature worthless (ADR-0033).
   */
  it('survives the run the correction itself started', async () => {
    // arrange / act
    const { id, after } = await corrected('corrected-survives');

    // assert — and still there after a second run over the same package
    expect(fieldOn(after, 'identity_card', 'document_no')?.value).toBe(
      AS_THE_OPERATOR_READS_IT,
    );

    await commands.execute(
      new AddFilesCommand(
        id.value,
        [aFile('corrected-survives', 'torpaq-plan-sxem.pdf')],
        null,
      ),
    );
    await waitForTerminalStatus(queries, id);

    const reread = await detailOf(id);
    expect(fieldOn(reread, 'identity_card', 'document_no')?.value).toBe(
      AS_THE_OPERATOR_READS_IT,
    );
    expect(fieldOn(reread, 'identity_card', 'document_no')?.origin).toBe(
      'EnteredByOperator',
    );
  });

  /*
   * An operator pressing save twice must not re-open a package that has been
   * re-verified since the first press. The row count is what proves nothing
   * happened: a run would have discarded the report and compiled a new one.
   */
  it('starts no run when every entry already holds that value', async () => {
    // arrange
    const { id, card, after } = await corrected('corrected-noop');

    // act — the same save again
    await commands.execute(
      new EditDocumentFieldsCommand(
        id.value,
        card.id,
        [{ name: 'document_no', value: AS_THE_OPERATOR_READS_IT }],
        OPERATOR,
      ),
    );

    // assert — the package never left the state the first correction left it in
    const settled = await detailOf(id);
    expect(settled.status).toBe(PackageStatus.COMPLETED.value);
    expect(settled.report?.generatedAt).toEqual(after.report?.generatedAt);
  });

  // The operator states the paper does not say it. The row has to go, or the
  // next read would serve a value the package no longer states.
  it('drops the key the operator strikes out', async () => {
    // arrange
    const id = await submitAndSettle('corrected-struck');
    const card = documentOf(await detailOf(id), 'identity_card')!;

    // act
    await commands.execute(
      new EditDocumentFieldsCommand(
        id.value,
        card.id,
        [{ name: 'expiry_date', value: null }],
        OPERATOR,
      ),
    );
    await waitForTerminalStatus(queries, id);

    // assert — and the extraction stage does not put it back, because the card
    // still carries machine readings of its other keys
    expect(fieldOn(await detailOf(id), 'identity_card', 'expiry_date')).toBe(
      undefined,
    );
  });

  it('refuses a correction while a run is reading the package', async () => {
    // arrange — a fresh package, settled, so its documents exist
    const id = await submitAndSettle('corrected-busy');
    const card = documentOf(await detailOf(id), 'identity_card')!;

    // ...and a second context whose reader holds the run open
    const held = new HeldOcr();
    const paused = await startContext(inject('databaseUrl'), { ocr: held });
    const pausedCommands = paused.module.get(CommandBus);

    try {
      await pausedCommands.execute(
        new AddFilesCommand(
          id.value,
          [aFile('corrected-busy', 'torpaq-plan-sxem.pdf')],
          null,
        ),
      );
      await held.asked;

      // act / assert
      await expect(
        pausedCommands.execute(
          new EditDocumentFieldsCommand(
            id.value,
            card.id,
            [{ name: 'document_no', value: 'AZE9999999' }],
            OPERATOR,
          ),
        ),
      ).rejects.toThrow(PackageNotTakingFilesException);
    } finally {
      held.release();
      await waitForTerminalStatus(queries, id);
      await paused.module.close();
    }
  });
});

/*
 * A value carried over from the corrected key, re-derived rather than left
 * pointing at a reading that no longer exists (ADR-0023).
 */
describe('a value another paper borrowed from the corrected key', () => {
  let module: TestingModule;
  let commands: CommandBus;
  let queries: QueryBus;

  beforeAll(async () => {
    ({ module } = await startContext(inject('databaseUrl'), {
      extractor: new AnAddressOnThePlanOnly(),
    }));
    commands = module.get(CommandBus);
    queries = module.get(QueryBus);
  });

  afterAll(async () => {
    await module?.close();
  });

  it('is derived again off the corrected value, not left stale', async () => {
    // arrange — the sketch design's address is closed from the plan-scheme
    const id: PackageId = await commands.execute(
      new CreatePackageCommand('cadastre', [
        aFile('corrected-carried', 'torpaq-plan-sxem.pdf'),
        aFile('corrected-carried', 'eskiz-layihe.pdf'),
      ]),
    );
    await waitForTerminalStatus(queries, id);

    const before: PackageDetailView = await queries.execute(
      new GetPackageQuery(id.value, null),
    );
    expect(fieldOn(before, 'sketch_project', 'property_address')?.origin).toBe(
      'TakenFromAnotherDocument',
    );
    expect(fieldOn(before, 'sketch_project', 'property_address')?.value).toBe(
      ADDRESS_ON_THE_PLAN,
    );

    // act — the operator corrects the paper the value was borrowed from
    await commands.execute(
      new EditDocumentFieldsCommand(
        id.value,
        documentOf(before, 'land_plot_plan')!.id,
        [
          {
            name: 'property_address',
            value: 'Zığ qəsəbəsi, Əliyev küçəsi 21',
          },
        ],
        OPERATOR,
      ),
    );
    await waitForTerminalStatus(queries, id);

    // assert
    const after: PackageDetailView = await queries.execute(
      new GetPackageQuery(id.value, null),
    );
    const carried = fieldOn(after, 'sketch_project', 'property_address');
    expect(carried?.value).toBe('Zığ qəsəbəsi, Əliyev küçəsi 21');
    expect(carried?.origin).toBe('TakenFromAnotherDocument');
    expect(carried?.takenFrom?.documentId).toBe(
      documentOf(after, 'land_plot_plan')!.id,
    );
  });
});

/*
 * What a correction invalidates, and what it leaves standing (ADR-0036).
 *
 * Here rather than only in a unit test because the two halves of it are
 * statements about the round trip and the run: a registry check the aggregate
 * dropped has to be *gone* from the database rather than upserted back on the
 * next save, an approval that was not spent has to still be in force after the
 * run the correction started, and "every cross-document check is made again"
 * is a statement about what the run asked the checker for.
 */
describe('what a correction leaves the package holding', () => {
  let module: TestingModule;
  let commands: CommandBus;
  let queries: QueryBus;
  let checker: ACountingCrossChecker;

  beforeAll(async () => {
    checker = new ACountingCrossChecker();
    ({ module } = await startContext(inject('databaseUrl'), {
      extractor: new AMisreadCardNumber(),
      crossChecker: checker,
    }));
    commands = module.get(CommandBus);
    queries = module.get(QueryBus);
  });

  afterAll(async () => {
    await module?.close();
  });

  const detailOf = async (id: PackageId): Promise<PackageDetailView> =>
    queries.execute(new GetPackageQuery(id.value, null));

  // A settled package with a person's signature on what the register answered
  // — the state every case below corrects a field from.
  async function approved(prefix: string): Promise<PackageId> {
    const id: PackageId = await commands.execute(
      new CreatePackageCommand('cadastre', [
        aFile(prefix, 'sexsiyyet-vesiqe.pdf'),
        aFile(prefix, 'erize-qeydiyyat.pdf'),
      ]),
    );
    await waitForTerminalStatus(queries, id);
    await commands.execute(
      new ApproveArchiveSearchCommand(
        id.value,
        'The archive answers for this submission.',
        undefined,
      ),
    );

    return id;
  }

  const inForce = (detail: PackageDetailView) =>
    detail.archiveSearchApprovals.filter(
      approval => approval.supersededAt === null,
    );

  /*
   * The identity card's expiry date is neither what the register was asked
   * about nor one of the values it was told, so the answer it gave still
   * stands — and so does the signature on it. ADR-0016 ends an approval
   * because the answers it covered no longer stand, which is not the same
   * thing as an operator having typed something somewhere.
   */
  it('keeps the register answer a correction does not reach, and the signature', async () => {
    // arrange
    const id = await approved('kept-answer');
    const before = await detailOf(id);
    const card = documentOf(before, 'identity_card')!;
    expect(before.registryChecks).toHaveLength(1);
    expect(inForce(before)).toHaveLength(1);

    // act
    await commands.execute(
      new EditDocumentFieldsCommand(
        id.value,
        card.id,
        [{ name: 'expiry_date', value: '01.01.2030' }],
        OPERATOR,
      ),
    );
    await waitForTerminalStatus(queries, id);

    // assert
    const after = await detailOf(id);
    expect(after.registryChecks.map(check => check.key)).toEqual(
      before.registryChecks.map(check => check.key),
    );
    expect(inForce(after)).toHaveLength(1);
  });

  /*
   * The register was asked about the address printed on this very sheet, so
   * its answer was given about something the package no longer states: the
   * check goes, the run asks again, and the signature over the old answer is
   * spent (ADR-0016).
   */
  it('drops the register answer that rests on the corrected reading, and spends the signature', async () => {
    // arrange
    const id = await approved('dropped-answer');
    const before = await detailOf(id);
    const application = documentOf(before, 'application')!;

    // act
    await commands.execute(
      new EditDocumentFieldsCommand(
        id.value,
        application.id,
        [{ name: 'property_address', value: 'Zığ qəsəbəsi, Əliyev küçəsi 21' }],
        OPERATOR,
      ),
    );

    // assert — gone the moment it was saved, and not sitting in the database
    // to be served on the next read
    const saved = await detailOf(id);
    expect(saved.registryChecks).toEqual([]);
    expect(inForce(saved)).toEqual([]);

    // ...and asked again by the run the correction started
    await waitForTerminalStatus(queries, id);
    const after = await detailOf(id);
    expect(after.registryChecks).toHaveLength(1);
    expect(after.registryChecks[0]?.asked.value).toBe(
      'Zığ qəsəbəsi, Əliyev küçəsi 21',
    );
  });

  /*
   * The checklist the operator is looking at when they press save must not go
   * blank for the length of a run: the verdicts of the last run stay readable
   * until this one replaces them (ADR-0036).
   */
  it('publishes the cross-check verdicts the whole way through the re-run', async () => {
    // arrange
    const id = await approved('verdicts-stand');
    const before = await detailOf(id);
    const card = documentOf(before, 'identity_card')!;
    const keys = before.crossChecks.map(check => check.key);
    expect(keys.length).toBeGreaterThan(0);

    // act
    await commands.execute(
      new EditDocumentFieldsCommand(
        id.value,
        card.id,
        [{ name: 'expiry_date', value: '02.02.2031' }],
        OPERATOR,
      ),
    );

    // assert — the save answers with the checklist it had, not an empty one.
    // The report is a different thing and does go: it is compiled from the
    // checks that are being made again, and half of it would be a finding
    // about a package nobody submitted.
    const saved = await detailOf(id);
    expect(saved.crossChecks.map(check => check.key)).toEqual(keys);
    expect(saved.report).toBeNull();

    await waitForTerminalStatus(queries, id);
    expect((await detailOf(id)).crossChecks.map(check => check.key)).toEqual(
      keys,
    );
  });

  /*
   * The full sweep the requester asked for: every Cross-document Check is made
   * again, and not only the ones naming the key that was typed into. The
   * expiry date of an identity card is named by no cross-check at all, and
   * both of the checks this package can make are still put to the checker
   * again (ADR-0036).
   */
  it('makes every cross-document check again, whatever key was corrected', async () => {
    // arrange
    const id = await approved('full-sweep');
    const before = await detailOf(id);
    const card = documentOf(before, 'identity_card')!;
    const made = before.crossChecks.map(check => check.key).toSorted();
    checker.asked.length = 0;

    // act
    await commands.execute(
      new EditDocumentFieldsCommand(
        id.value,
        card.id,
        [{ name: 'expiry_date', value: '03.03.2032' }],
        OPERATOR,
      ),
    );
    await waitForTerminalStatus(queries, id);

    // assert
    expect(checker.asked.toSorted()).toEqual(made);
  });
});
