import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import type { AddressLookupResponse } from '@cadastre/api-contracts/registry';
import { Logger, type LogContext } from '@cadastre/logger';

import type { VerificationPackage } from '../../../../domain/aggregates/index.js';
import {
  Document,
  Page,
  type SourceFile,
} from '../../../../domain/entities/index.js';
import {
  Confidence,
  CrossCheck,
  FailureReason,
  PackageId,
  PageImage,
  PageNumber,
  RecognisedText,
  RegistryAttribute,
  RegistryCheck,
  RegistryDocument,
  RegistryOutcome,
  type CrossCheckSpec,
  type DocumentId,
  type PageRange,
  type RegistryCheckSpec,
  type SourceFileId,
  type VerificationProfile,
} from '../../../../domain/value-objects/index.js';
import { PackageNotFoundException } from '../../../exceptions/index.js';
import {
  ArchiveRegistryPort,
  CrossChecker,
  DocumentClassifier,
  DocumentSegmenter,
  FieldExtractor,
  IdGenerator,
  OcrProvider,
  PdfSplitter,
  VerificationPackageRepository,
} from '../../../ports/outbound/index.js';

import { RunVerificationCommand } from './run-verification.command.js';

// How many times one sheet is offered to the reader before the report says it
// could not be read. Providers rate-limit and time out for reasons that have
// nothing to do with the sheet in hand, and the second ask usually succeeds.
const ATTEMPTS_PER_SHEET = 3;

@CommandHandler(RunVerificationCommand)
export class RunVerificationHandler implements ICommandHandler<
  RunVerificationCommand,
  void
> {
  private readonly logger: Logger;

  constructor(
    @Inject(Logger) logger: Logger,
    @Inject(VerificationPackageRepository)
    private readonly packages: VerificationPackageRepository,
    @Inject(IdGenerator) private readonly ids: IdGenerator,
    @Inject(PdfSplitter) private readonly pdf: PdfSplitter,
    @Inject(OcrProvider) private readonly ocr: OcrProvider,
    @Inject(DocumentSegmenter) private readonly segmenter: DocumentSegmenter,
    @Inject(DocumentClassifier) private readonly classifier: DocumentClassifier,
    @Inject(FieldExtractor) private readonly extractor: FieldExtractor,
    @Inject(CrossChecker) private readonly crossChecker: CrossChecker,
    @Inject(ArchiveRegistryPort) private readonly registry: ArchiveRegistryPort,
  ) {
    this.logger = logger.child({ scope: RunVerificationHandler.name });
  }

  // A stage that cannot do its work does not stop the run: a file that will not
  // split, a sheet the reader refuses, a document nothing can place — each is
  // carried through to the report and handed to the inspector, which is what
  // the operator asked for. Only losing the package itself ends a run.
  async execute(command: RunVerificationCommand): Promise<void> {
    const packageId = PackageId.of(command.packageId);
    const startedAt = Date.now();

    await this.change(packageId, verification => verification.start());

    try {
      const submitted = await this.load(packageId);
      const fileIds = submitted.files.map(file => file.id);

      // Said once, at the top of the run: what was submitted, and what it is
      // about to be judged against. Every line below is an event within this
      // one, and they all carry the same packageId.
      this.logger.log('Verification started', {
        packageId: packageId.value,
        profile: submitted.profile.key,
        files: submitted.files.map(file => ({
          id: file.id.value,
          filename: file.filename.value,
          contentType: file.contentType.value,
        })),
        expects: submitted.profile.specs.length,
        crossChecks: submitted.profile.crossChecks.length,
        registryChecks: submitted.profile.registryChecks.length,
      });

      // Every file is read to the end before any of it is classified: what one
      // sheet says is how the sheet after it is told to be part of the same
      // document or the start of the next.
      for (const fileId of fileIds) {
        const file = { packageId, sourceFileId: fileId.value };

        await this.despite('split', file, () => this.split(packageId, fileId));
        await this.despite('recognise', file, () =>
          this.recognise(packageId, fileId),
        );
        await this.despite('segment', file, () =>
          this.segment(packageId, fileId),
        );
      }

      const documentIds = (await this.load(packageId)).documents.map(
        document => document.id,
      );

      for (const documentId of documentIds) {
        const document = { packageId, documentId: documentId.value };

        await this.despite('classify', document, () =>
          this.classify(packageId, documentId),
        );
        await this.despite('extract', document, () =>
          this.extract(packageId, documentId),
        );
      }

      // Every document has said what it says before any of them are held
      // against each other: a check reads values off two papers, so it cannot
      // run until both have been read.
      for (const spec of (await this.load(packageId)).profile.crossChecks) {
        await this.despite(
          'cross-check',
          { packageId, check: spec.key.value },
          () => this.crossCheck(packageId, spec),
        );
      }

      // Last, because it needs the values every stage above it produced, and
      // because it is the only one that leaves the submission: everything up to
      // here is what the papers say, and this is what the record says
      // (ADR-0009).
      for (const spec of (await this.load(packageId)).profile.registryChecks) {
        await this.despite(
          'registry',
          { packageId, check: spec.key.value },
          () => this.askRegister(packageId, spec),
        );
      }

      // Completing is what compiles the report, so a run that read almost
      // nothing still ends with one.
      await this.change(packageId, verification => verification.complete());

      const finished = await this.load(packageId);
      const report = finished.report;

      this.logger.log('Verification finished', {
        packageId: packageId.value,
        status: finished.status.value,
        report: report?.status.value ?? 'none',
        documents: documentIds.length,
        files: fileIds.length,
        pages: finished.files.reduce(
          (count, file) => count + file.pages.length,
          0,
        ),
        findings: report?.issues.length ?? 0,
        // The findings themselves, not only how many: this is what the
        // inspector will be shown, and reading it here is how a wrong one is
        // traced back to the stage that produced it.
        issues: report?.issues.map(issue => ({
          kind: issue.kind.value,
          message: issue.message,
        })),
        crossChecks: finished.crossChecks.map(check => ({
          key: check.key.value,
          verdict: check.verdict.value,
          confidence: round(check.confidence.value),
        })),
        registryChecks: finished.registryChecks.map(check => ({
          key: check.key.value,
          outcome: check.outcome.value,
          confidence: round(check.confidence.value),
        })),
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      this.logger.error('Verification could not be completed', {
        packageId: packageId.value,
        durationMs: Date.now() - startedAt,
        error,
      });
      await this.recordFailure(packageId, error);
      throw error;
    }
  }

  private async despite(
    what: string,
    subject: { packageId: PackageId } & LogContext,
    stage: () => Promise<void>,
  ): Promise<void> {
    const { packageId, ...rest } = subject;
    const context = { packageId: packageId.value, stage: what, ...rest };
    const startedAt = Date.now();

    this.logger.debug(`Stage "${what}" started`, context);

    try {
      await stage();
      this.logger.debug(`Stage "${what}" finished`, {
        ...context,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      this.logger.warn(
        `Stage "${what}" failed — the run continues and the report will say so`,
        { ...context, durationMs: Date.now() - startedAt, error },
      );
    }
  }

  private async split(
    packageId: PackageId,
    sourceFileId: SourceFileId,
  ): Promise<void> {
    const verification = await this.load(packageId);
    const file = verification.fileWith(sourceFileId);

    if (file.isSplit) return;

    const pages = await this.pagesOf(file);

    verification.splitIntoPages(sourceFileId, pages);
    await this.packages.save(verification);

    this.logger.log('File split into pages', {
      packageId: packageId.value,
      sourceFileId: sourceFileId.value,
      filename: file.filename.value,
      contentType: file.contentType.value,
      pages: pages.length,
    });
  }

  private async pagesOf(file: SourceFile): Promise<readonly Page[]> {
    // A single-image file is already the one page it consists of; only a PDF has
    // sheets to render out.
    if (!file.contentType.splitsIntoPages) {
      return [
        Page.create(
          this.ids.pageId(),
          PageNumber.first(),
          PageImage.of(file.storageKey, file.contentType),
        ),
      ];
    }

    const split = await this.pdf.split({ storageKey: file.storageKey });

    return split.map(page =>
      Page.create(this.ids.pageId(), page.number, page.image),
    );
  }

  // Terminates because every failure is counted against the sheet it happened
  // to, and a sheet that has used up its attempts is no longer offered: the
  // queue empties whether the provider cooperates or not.
  //
  // A refusal used to end the whole file — one rate-limited sheet in the middle
  // of a twenty-six page submission left twenty of them unread and the report
  // announced a package that was not there. A provider saying no to one page is
  // not a provider saying no, so each sheet gets its own few tries and the rest
  // of the file goes on without it.
  private async recognise(
    packageId: PackageId,
    sourceFileId: SourceFileId,
  ): Promise<void> {
    const refusals = new Map<string, number>();
    const spent = (pageId: string): boolean =>
      (refusals.get(pageId) ?? 0) >= ATTEMPTS_PER_SHEET;

    for (;;) {
      const verification = await this.load(packageId);
      const file = verification.fileWith(sourceFileId);
      const batch = file.unrecognisedPages
        .filter(page => !spent(page.id.value))
        .slice(0, this.ocr.pagesAtOnce);

      if (batch.length === 0) return;

      this.logger.debug('Offering sheets to the reader', {
        packageId: packageId.value,
        sourceFileId: sourceFileId.value,
        filename: file.filename.value,
        sheets: batch.map(page => page.number.value),
        stillUnread: file.unrecognisedPages.length,
      });

      const startedAt = Date.now();
      const readings = await Promise.allSettled(
        batch.map(page => this.ocr.recognise(page.image)),
      );

      let recognised = 0;
      for (const [index, reading] of readings.entries()) {
        const page = batch[index];
        if (!page) continue;

        if (reading.status !== 'fulfilled') {
          const tries = (refusals.get(page.id.value) ?? 0) + 1;
          refusals.set(page.id.value, tries);
          this.logger.warn('Sheet could not be read', {
            packageId: packageId.value,
            sourceFileId: sourceFileId.value,
            filename: file.filename.value,
            sheet: page.number.value,
            attempt: tries,
            of: ATTEMPTS_PER_SHEET,
            givingUp: tries >= ATTEMPTS_PER_SHEET,
            error: reading.reason,
          });
          continue;
        }

        this.logger.debug('Sheet read', {
          packageId: packageId.value,
          sourceFileId: sourceFileId.value,
          sheet: page.number.value,
          characters: reading.value.text.value.length,
          confidence: round(reading.value.confidence.value),
        });

        verification.recordRecognition(sourceFileId, page.id, reading.value);
        recognised += 1;
      }

      this.logger.log('Sheets read', {
        packageId: packageId.value,
        sourceFileId: sourceFileId.value,
        filename: file.filename.value,
        offered: batch.length,
        read: recognised,
        refused: batch.length - recognised,
        durationMs: Date.now() - startedAt,
      });

      // Saved as soon as anything came back: what the provider did read is paid
      // for, so a re-run asks it only for the pages still unread.
      if (recognised > 0) await this.packages.save(verification);
    }
  }

  private async segment(
    packageId: PackageId,
    sourceFileId: SourceFileId,
  ): Promise<void> {
    const verification = await this.load(packageId);
    const file = verification.fileWith(sourceFileId);

    if (verification.isSegmented(sourceFileId)) return;

    const ranges = await this.rangesIn(file, verification.profile);
    if (ranges.length === 0) return;

    const documents = ranges.map(range =>
      Document.create(this.ids.documentId(), sourceFileId, range),
    );

    verification.segmentIntoDocuments(sourceFileId, documents);
    await this.packages.save(verification);

    this.logger.log('File read into documents', {
      packageId: packageId.value,
      sourceFileId: sourceFileId.value,
      filename: file.filename.value,
      documents: documents.length,
      ranges: ranges.map(describe),
    });
  }

  private async rangesIn(
    file: SourceFile,
    profile: VerificationProfile,
  ): Promise<readonly PageRange[]> {
    const whole = file.wholeFile;

    if (!whole) return [];

    // One sheet is one document: there is no boundary to look for, and no
    // reason to pay a provider to confirm it.
    if (whole.isSingleSheet) return [whole];

    try {
      return await this.segmenter.segment({
        pages: file.transcript(),
        candidates: profile.specs,
      });
    } catch (error) {
      // A file whose boundaries could not be found is still one run of sheets,
      // and one document the classifier can be asked about, rather than pages
      // that reach no stage at all.
      this.logger.warn(
        'File could not be read into documents; taking it as one',
        { filename: file.filename.value, sheets: file.pages.length, error },
      );

      return [whole];
    }
  }

  private async classify(
    packageId: PackageId,
    documentId: DocumentId,
  ): Promise<void> {
    const verification = await this.load(packageId);
    const document = verification.documentWith(documentId);

    if (document.isClassified) return;

    const classification = await this.classifier.classify({
      text: verification.textOf(documentId),
      candidates: verification.profile.specs,
    });

    verification.classify(documentId, classification);
    await this.packages.save(verification);

    const file = verification.fileWith(document.sourceFileId);
    this.logger.log('Document classified', {
      packageId: packageId.value,
      documentId: documentId.value,
      filename: file.filename.value,
      sheets: describe(document.pages),
      type: classification.type.value,
      // Which of the papers the catalogue knows this turned out to be, where it
      // is one: "out_of_profile" says only what the document is not, and this
      // is what the finding will name it by (ADR-0012).
      knownAs: classification.knownAs?.value ?? null,
      confidence: round(classification.confidence.value),
      // A document the profile does not ask for is not a failure, but it is
      // the reason a required type ends up reported missing.
      inProfile: classification.isPlaced,
    });
  }

  private async extract(
    packageId: PackageId,
    documentId: DocumentId,
  ): Promise<void> {
    const verification = await this.load(packageId);
    const document = verification.documentWith(documentId);
    const classification = document.classification;

    if (!classification?.isPlaced || document.hasFields) return;

    const spec = verification.profile.specFor(classification.type);
    if (spec.schema.isEmpty) return;

    const startedAt = Date.now();
    const fields = await this.extractor.extract({
      text: verification.textOf(documentId),
      sheets: verification.sheetsOf(documentId).map(page => ({
        number: page.number,
        image: page.image,
        text: page.ocr?.text ?? RecognisedText.empty(),
        read: page.ocr?.confidence ?? Confidence.none(),
      })),
      spec,
    });

    // Logged before the early return, because "the extractor read nothing off
    // a document it was asked about" is the interesting case, not the silent
    // one: the report will say the fields are missing and this is why.
    this.logger.log('Fields extracted', {
      packageId: packageId.value,
      documentId: documentId.value,
      type: classification.type.value,
      asked: spec.schema.specs.length,
      read: fields.length,
      durationMs: Date.now() - startedAt,
      fields: fields.map(field => ({
        key: field.key.value,
        // The value itself is not logged: these are names, addresses and
        // identity card numbers off somebody's papers.
        read: field.value.value.length > 0,
        confidence: round(field.confidence.value),
      })),
    });

    if (fields.length === 0) return;

    verification.recordExtractedFields(documentId, fields);
    await this.packages.save(verification);
  }

  // A value is only as good as the reading it came from, and a check is only as
  // good as the values it weighed: the reader's own certainty is capped by the
  // least confident value on the table. A name read at 0.4 off a faint card
  // cannot produce a mismatch anyone should act on at 0.95.
  private async crossCheck(
    packageId: PackageId,
    spec: CrossCheckSpec,
  ): Promise<void> {
    const verification = await this.load(packageId);

    if (verification.hasMade(spec.key)) return;
    if (!verification.canMake(spec)) {
      // Not a failure and not a finding here: the report says a check could
      // not be made, and this says which values it was waiting for.
      this.logger.log(
        'Cross-check not attempted — a value it needs is missing',
        {
          packageId: packageId.value,
          check: spec.key.value,
          needs: spec.references.map(
            reference => `${reference.type.value}.${reference.key.value}`,
          ),
        },
      );
      return;
    }

    const values = verification.valuesFor(spec);
    const startedAt = Date.now();
    const answer = await this.crossChecker.check({ spec, values });
    const read = Math.min(...values.map(value => value.confidence.value));

    verification.recordCrossCheck(
      CrossCheck.of({
        key: spec.key,
        verdict: answer.verdict,
        confidence: Confidence.of(Math.min(read, answer.confidence.value)),
        note: answer.note,
        values,
      }),
    );
    await this.packages.save(verification);

    this.logger.log('Cross-check made', {
      packageId: packageId.value,
      check: spec.key.value,
      verdict: answer.verdict.value,
      // Three numbers, because a surprising verdict is nearly always the
      // cheapest of them: what the checker said, how well the values behind it
      // were read, and what the inspector is therefore told.
      stated: round(answer.confidence.value),
      readAt: round(read),
      confidence: round(Math.min(read, answer.confidence.value)),
      note: answer.note,
      values: values.map(value => ({
        of: `${value.documentType.value}.${value.fieldKey.value}`,
        confidence: round(value.confidence.value),
      })),
      durationMs: Date.now() - startedAt,
    });
  }

  /*
   * The one stage that leaves the submission: it asks the archive register what
   * it holds about the property, and holds what the papers say against what the
   * record says.
   *
   * The register answers with facts and no verdict, which is deliberate — what
   * an absent record or a differing owner means is the profile's rule and is
   * applied here, where the profile is (ADR-0009). A register that is down
   * throws, `despite` catches it, and the run finishes without the check rather
   * than failing over a source that is not the submission.
   */
  private async askRegister(
    packageId: PackageId,
    spec: RegistryCheckSpec,
  ): Promise<void> {
    const verification = await this.load(packageId);

    if (verification.hasAsked(spec.key)) return;

    const asked = verification.askedOf(spec);

    if (!asked) {
      // Not a failure and not a finding here: a value nobody could read is
      // already in the report as the reading that failed.
      this.logger.log(
        'Registry check not attempted — the value it asks about is missing',
        {
          packageId: packageId.value,
          check: spec.key.value,
          needs: spec.subjects
            .map(subject => `${subject.type.value}.${subject.key.value}`)
            .join(' | '),
        },
      );
      return;
    }

    const stated = verification.statedFor(spec);
    const carried = verification.carriedFor(spec);
    const startedAt = Date.now();
    const answer = await this.registry.addresses.lookup({
      address: asked.value.value,
      attributes: stated.map(({ name, value }) => ({
        name,
        value: value.value.value,
      })),
      // The register knows the papers by its own words; the type key rides
      // along untouched so a finding lands on the sheet it came off (ADR-0010).
      documents: carried.map(({ name, carried: value }) => ({
        name,
        type: value.documentType.value,
      })),
    });

    const attributes = stated.flatMap(({ name, value }) => {
      const held = answer.attributes.find(one => one.name === name);

      return held
        ? [
            RegistryAttribute.of({
              name,
              agrees: held.match === 'Matches',
              submitted: value,
              recorded: held.recorded,
            }),
          ]
        : [];
    });

    const documents = carried.flatMap(({ name, carried: value }) => {
      const said = answer.documents.find(one => one.name === name);

      return said
        ? [
            RegistryDocument.of({
              name,
              holding: said.holding,
              carried: value,
              recordedNumber: said.number,
              recordedDate: said.issuedOn,
              reference: said.location
                ? `folder ${said.location.folder}, pp. ${said.location.pages}`
                : null,
            }),
          ]
        : [];
    });

    const outcome = outcomeOf(answer.outcome, attributes, documents);
    // Never surer than the reading it was made from: an address the extractor
    // half-guessed cannot produce a confident answer about the property.
    const read = Math.min(
      asked.confidence.value,
      ...stated.map(({ value }) => value.confidence.value),
    );

    verification.recordRegistryCheck(
      RegistryCheck.of({
        key: spec.key,
        outcome,
        confidence: Confidence.of(read),
        note: answer.note,
        asked,
        reference: locatorOf(answer),
        attributes,
        documents,
      }),
    );
    await this.packages.save(verification);

    this.logger.log('Registry check made', {
      packageId: packageId.value,
      check: spec.key.value,
      outcome: outcome.value,
      candidates: answer.candidates,
      confidence: round(read),
      // The names and how each stood, never the values: they are read off
      // somebody's papers (ADR-0008).
      attributes: attributes.map(attribute => ({
        of: `${attribute.submitted.documentType.value}.${attribute.submitted.fieldKey.value}`,
        as: attribute.name,
        stood: attribute.isSilent
          ? 'not recorded'
          : attribute.agrees
            ? 'agrees'
            : 'differs',
      })),
      // The kinds of paper and what the archive said about each — never a
      // number off one of them, which is somebody's papers (ADR-0008).
      documents: documents.map(document => ({
        of: document.carried.documentType.value,
        as: document.name,
        stood: document.holding,
      })),
      reference: locatorOf(answer),
      note: answer.note,
      durationMs: Date.now() - startedAt,
    });
  }

  private async change(
    packageId: PackageId,
    change: (verification: VerificationPackage) => void,
  ): Promise<void> {
    const verification = await this.load(packageId);
    change(verification);
    await this.packages.save(verification);
  }

  private async load(packageId: PackageId): Promise<VerificationPackage> {
    const verification = await this.packages.findById(packageId);

    if (!verification) throw new PackageNotFoundException(packageId);

    return verification;
  }

  private async recordFailure(
    packageId: PackageId,
    cause: unknown,
  ): Promise<void> {
    try {
      await this.change(packageId, verification =>
        verification.fail(FailureReason.create(String(cause))),
      );
    } catch (error) {
      this.logger.error('Could not mark the package failed', {
        packageId: packageId.value,
        cause: String(cause),
        error,
      });
    }
  }
}

// Confidences are logged to two places, which is what they are worth: a third
// decimal invites a reader to compare two readings that are not different.
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * What the register said, turned into what it means for this package. The
 * register knows whether it holds a record; only the profile knows that a
 * record saying something else is a fault and a record that is absent is not.
 */
function outcomeOf(
  answered: AddressLookupResponse['outcome'],
  attributes: readonly RegistryAttribute[],
  documents: readonly RegistryDocument[],
): RegistryOutcome {
  if (answered === 'NotFound') return RegistryOutcome.NOT_FOUND;
  if (answered === 'Ambiguous') return RegistryOutcome.AMBIGUOUS;

  // A record that says something else outranks a file that is short a paper:
  // both are reported as findings, and the check carries the graver of the two.
  if (attributes.some(attribute => attribute.differs)) {
    return RegistryOutcome.DIFFERS;
  }

  // Only a paper the register recorded the absence of. One it is silent about
  // is a column that area never kept, which is not evidence of anything.
  return documents.some(document => document.isMissing)
    ? RegistryOutcome.INCOMPLETE
    : RegistryOutcome.CONFIRMED;
}

// Where the paper is, in one line for the audit trail. Folder and page stay
// strings: "01-dən 30" is a real page range and a number cannot hold it.
function locatorOf(answer: AddressLookupResponse): string | null {
  const location = answer.record?.location;

  if (!location) return null;

  return `folder ${location.folder}, pp. ${location.pages}`;
}

function describe(range: PageRange): string {
  return range.isSingleSheet
    ? `p.${range.first.value}`
    : `pp.${range.first.value}–${range.last.value}`;
}
