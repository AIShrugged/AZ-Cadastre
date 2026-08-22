import { describe, expect, it } from 'vitest';

import { VerificationPackage } from '../../../domain/aggregates/index.js';
import {
  ExtractedField,
  SourceFile,
  type Document,
} from '../../../domain/entities/index.js';
import { PackageNotStartableException } from '../../../domain/exceptions/index.js';
import {
  Classification,
  Confidence,
  ContentType,
  CrossCheckVerdict,
  DocumentId,
  DocumentType,
  FieldKey,
  FieldValue,
  Filename,
  OcrResult,
  PackageId,
  PageId,
  PageImage,
  PageNumber,
  PageRange,
  RecognisedText,
  SourceFileId,
  StorageKey,
  VerificationProfile,
} from '../../../domain/value-objects/index.js';
import {
  CrossChecker,
  DocumentClassifier,
  DocumentSegmenter,
  FieldExtractor,
  IdGenerator,
  OcrProvider,
  PdfSplitter,
  VerificationPackageRepository,
  type ClassificationRequest,
  type CrossCheckAnswer,
  type CrossCheckRequest,
  type ExtractionRequest,
  type PdfSplitRequest,
  type SegmentationRequest,
  type SplitPage,
} from '../../ports/outbound/index.js';

import { RunVerificationCommand } from './run-verification.command.js';
import { RunVerificationHandler } from './run-verification.handler.js';

const PACKAGE_ID = '0190a1b2-c3d4-7e5f-8a9b-000000000001';

let sequence = 0;

function anId(): string {
  sequence += 1;
  return `0190a1b2-c3d4-7e5f-8a9b-${sequence.toString(16).padStart(12, '0')}`;
}

class InMemoryPackages extends VerificationPackageRepository {
  constructor(private stored: VerificationPackage) {
    super();
  }

  override async save(verificationPackage: VerificationPackage): Promise<void> {
    this.stored = verificationPackage;
    verificationPackage.commit();
  }

  override async findById(): Promise<VerificationPackage | null> {
    return this.stored;
  }
}

class SequentialIds extends IdGenerator {
  override packageId(): PackageId {
    return PackageId.of(anId());
  }

  override sourceFileId(): SourceFileId {
    return SourceFileId.of(anId());
  }

  override documentId(): DocumentId {
    return DocumentId.of(anId());
  }

  override pageId(): PageId {
    return PageId.of(anId());
  }
}

class RenderingSplitter extends PdfSplitter {
  readonly asked: PdfSplitRequest[] = [];

  constructor(private readonly sheets: number) {
    super();
  }

  override async split(
    request: PdfSplitRequest,
  ): Promise<readonly SplitPage[]> {
    this.asked.push(request);

    return Array.from({ length: this.sheets }, (_, index) => ({
      number: PageNumber.of(index + 1),
      image: PageImage.of(
        StorageKey.create(
          `${request.storageKey.value}/pages/page_${String(index + 1).padStart(3, '0')}.png`,
        ),
        ContentType.PNG,
      ),
    }));
  }
}

class RefusingSplitter extends PdfSplitter {
  override split(): Promise<readonly SplitPage[]> {
    throw new Error('no PDF is split in this test');
  }
}

class RecordingOcr extends OcrProvider {
  readonly read: PageImage[] = [];
  peakInFlight = 0;
  #inFlight = 0;

  constructor(
    override readonly pagesAtOnce = 8,
    private readonly refuse: (image: PageImage) => boolean = () => false,
  ) {
    super();
  }

  override async recognise(image: PageImage): Promise<OcrResult> {
    this.read.push(image);
    this.#inFlight += 1;
    this.peakInFlight = Math.max(this.peakInFlight, this.#inFlight);

    // A turn of the event loop, so a reading only finishes after every reading
    // started alongside it has begun.
    await new Promise(resolve => setTimeout(resolve, 0));
    this.#inFlight -= 1;

    if (this.refuse(image)) {
      throw new Error(`no reading of ${image.storageKey.value}`);
    }

    return OcrResult.of(
      RecognisedText.of(`text of ${image.storageKey.value}`),
      Confidence.of(0.9),
    );
  }
}

// Cuts a file into documents at the sheets it was told to, so a test can say
// "this PDF holds three documents" without a real model.
class SegmenterCuttingAt extends DocumentSegmenter {
  readonly asked: SegmentationRequest[] = [];

  constructor(private readonly starts: readonly number[] = []) {
    super();
  }

  override async segment(
    request: SegmentationRequest,
  ): Promise<readonly PageRange[]> {
    this.asked.push(request);

    const boundaries = [1, ...this.starts];
    const total = request.pages.length;

    return boundaries.map((start, index) =>
      PageRange.of(
        PageNumber.of(start),
        PageNumber.of((boundaries[index + 1] ?? total + 1) - 1),
      ),
    );
  }
}

class RecordingClassifier extends DocumentClassifier {
  readonly asked: ClassificationRequest[] = [];

  override async classify(
    request: ClassificationRequest,
  ): Promise<Classification> {
    this.asked.push(request);

    return Classification.of(
      DocumentType.create('identity_card'),
      Confidence.of(0.9),
    );
  }
}

class NoFields extends FieldExtractor {
  override async extract(): Promise<readonly ExtractedField[]> {
    return [];
  }
}

class RecordingCrossChecker extends CrossChecker {
  readonly asked: CrossCheckRequest[] = [];

  constructor(
    private readonly verdict: CrossCheckVerdict = CrossCheckVerdict.MATCH,
  ) {
    super();
  }

  override async check(request: CrossCheckRequest): Promise<CrossCheckAnswer> {
    this.asked.push(request);

    return {
      verdict: this.verdict,
      confidence: Confidence.of(0.95),
      note: 'compared in a test',
    };
  }
}

function aPackageOf(...files: readonly SourceFile[]): VerificationPackage {
  return VerificationPackage.create(
    PackageId.of(PACKAGE_ID),
    VerificationProfile.CADASTRE,
    files,
  );
}

function aFile(filename: string, contentType: ContentType): SourceFile {
  return SourceFile.create(
    SourceFileId.of(anId()),
    Filename.create(filename),
    contentType,
    StorageKey.create(`${anId()}/${filename}`),
  );
}

function pipelineOver(
  verification: VerificationPackage,
  pdf: PdfSplitter,
  ocr: RecordingOcr = new RecordingOcr(),
  segmenter: DocumentSegmenter = new SegmenterCuttingAt(),
  classifier: DocumentClassifier = new RecordingClassifier(),
  extractor: FieldExtractor = new NoFields(),
  crossChecker: CrossChecker = new RecordingCrossChecker(),
): {
  run: () => Promise<void>;
  packages: InMemoryPackages;
  ocr: RecordingOcr;
} {
  const packages = new InMemoryPackages(verification);
  const handler = new RunVerificationHandler(
    packages,
    new SequentialIds(),
    pdf,
    ocr,
    segmenter,
    classifier,
    extractor,
    crossChecker,
  );

  return {
    run: () => handler.execute(new RunVerificationCommand(PACKAGE_ID)),
    packages,
    ocr,
  };
}

async function storedPackage(
  packages: InMemoryPackages,
): Promise<VerificationPackage> {
  return (await packages.findById())!;
}

async function documentsAfter(
  packages: InMemoryPackages,
): Promise<readonly Document[]> {
  return (await storedPackage(packages)).documents;
}

function spansOf(documents: readonly Document[]): [number, number][] {
  return documents.map(document => [
    document.pages.first.value,
    document.pages.last.value,
  ]);
}

describe('RunVerificationHandler', () => {
  it('makes a page of every sheet the PDF was split into', async () => {
    const file = aFile('submission.pdf', ContentType.PDF);
    const { run, packages } = pipelineOver(
      aPackageOf(file),
      new RenderingSplitter(3),
    );

    await run();

    const stored = await storedPackage(packages);
    expect(
      stored.fileWith(file.id).pages.map(page => page.number.value),
    ).toEqual([1, 2, 3]);
  });

  it('gives each page the image the splitter rendered for it', async () => {
    const file = aFile('submission.pdf', ContentType.PDF);
    const { run, packages } = pipelineOver(
      aPackageOf(file),
      new RenderingSplitter(2),
    );

    await run();

    const stored = await storedPackage(packages);
    expect(
      stored.fileWith(file.id).pages.map(page => page.image.storageKey.value),
    ).toEqual([
      `${file.storageKey.value}/pages/page_001.png`,
      `${file.storageKey.value}/pages/page_002.png`,
    ]);
  });

  it('splits the PDF once, by the key the file was uploaded under', async () => {
    const file = aFile('deed.pdf', ContentType.PDF);
    const splitter = new RenderingSplitter(2);

    await pipelineOver(aPackageOf(file), splitter).run();

    expect(splitter.asked).toEqual([{ storageKey: file.storageKey }]);
  });

  it('reads every sheet of a PDF, each as the PNG it was rendered to', async () => {
    const { run, ocr } = pipelineOver(
      aPackageOf(aFile('submission.pdf', ContentType.PDF)),
      new RenderingSplitter(3),
    );

    await run();

    expect(ocr.read).toHaveLength(3);
    for (const image of ocr.read) {
      expect(image.contentType.equals(ContentType.PNG)).toBe(true);
    }
  });

  it('reads the sheets of one file at the same time, not one after another', async () => {
    const { run, ocr } = pipelineOver(
      aPackageOf(aFile('submission.pdf', ContentType.PDF)),
      new RenderingSplitter(4),
    );

    await run();

    expect(ocr.peakInFlight).toBe(4);
  });

  it('reads no more pages at once than the provider says it will take', async () => {
    const ocr = new RecordingOcr(2);
    const file = aFile('submission.pdf', ContentType.PDF);
    const { run, packages } = pipelineOver(
      aPackageOf(file),
      new RenderingSplitter(5),
      ocr,
    );

    await run();

    expect(ocr.peakInFlight).toBe(2);
    const stored = await storedPackage(packages);
    expect(stored.fileWith(file.id).isFullyRecognised).toBe(true);
  });

  it('keeps the readings it got when one page of the batch fails', async () => {
    const file = aFile('submission.pdf', ContentType.PDF);
    const refusesPageTwo = (image: PageImage) =>
      image.storageKey.value.endsWith('page_002.png');
    const { run, packages } = pipelineOver(
      aPackageOf(file),
      new RenderingSplitter(3),
      new RecordingOcr(8, refusesPageTwo),
    );

    await run();

    const stored = await storedPackage(packages);
    expect(
      stored.fileWith(file.id).pages.map(page => page.isRecognised),
    ).toEqual([true, false, true]);
  });

  it('finishes a run whose reader refused a sheet, and reports the sheet', async () => {
    const file = aFile('submission.pdf', ContentType.PDF);
    const refusesPageTwo = (image: PageImage) =>
      image.storageKey.value.endsWith('page_002.png');
    const { run, packages } = pipelineOver(
      aPackageOf(file),
      new RenderingSplitter(3),
      new RecordingOcr(8, refusesPageTwo),
    );

    await run();

    const stored = await storedPackage(packages);
    expect(stored.status.value).toBe('Completed');
    expect(
      stored.report?.issues.map(issue => [
        issue.kind.value,
        issue.pageNumber?.value,
      ]),
    ).toContainEqual(['UnreadableDocument', 2]);
  });

  it('asks again for a sheet the provider refused, and gives up on it in the end', async () => {
    // Providers rate-limit and time out for reasons that have nothing to do
    // with the sheet in hand, so one refusal is not an answer about the sheet.
    // The asking is bounded, though: a page nobody will read must not hold the
    // run open.
    const file = aFile('submission.pdf', ContentType.PDF);
    const refusesPageTwo = (image: PageImage) =>
      image.storageKey.value.endsWith('page_002.png');
    const ocr = new RecordingOcr(8, refusesPageTwo);
    const { run } = pipelineOver(
      aPackageOf(file),
      new RenderingSplitter(3),
      ocr,
    );

    await run();

    const asked = ocr.read.filter(image =>
      image.storageKey.value.endsWith('page_002.png'),
    );
    expect(asked.length).toBeGreaterThan(1);
    expect(asked.length).toBeLessThanOrEqual(3);
  });

  it('reads the sheets after the one it was refused, rather than abandoning the file', async () => {
    // A rate-limited sheet in the middle of a long submission used to end the
    // reading of everything after it, and the report then announced a package
    // that was not the one submitted.
    const file = aFile('submission.pdf', ContentType.PDF);
    const refusesPageTwo = (image: PageImage) =>
      image.storageKey.value.endsWith('page_002.png');
    const { run, packages } = pipelineOver(
      aPackageOf(file),
      new RenderingSplitter(6),
      // One sheet at a time, so the refusal falls in a batch of its own and
      // everything after it depends on the run carrying on.
      new RecordingOcr(1, refusesPageTwo),
    );

    await run();

    const stored = await storedPackage(packages);
    expect(
      stored.fileWith(file.id).pages.map(page => page.isRecognised),
    ).toEqual([true, false, true, true, true, true]);
  });

  it('takes a photographed file as the single page it already is', async () => {
    const file = aFile('scan.jpg', ContentType.JPEG);
    const { run, packages } = pipelineOver(
      aPackageOf(file),
      new RefusingSplitter(),
    );

    await run();

    const pages = (await storedPackage(packages)).fileWith(file.id).pages;
    expect(pages).toHaveLength(1);
    expect(pages[0]?.image.storageKey.equals(file.storageKey)).toBe(true);
    expect(pages[0]?.image.contentType.equals(ContentType.JPEG)).toBe(true);
  });

  it('splits the PDFs of a package and leaves its images alone', async () => {
    const scan = aFile('scan.png', ContentType.PNG);
    const first = aFile('passport.pdf', ContentType.PDF);
    const second = aFile('application.pdf', ContentType.PDF);
    const splitter = new RenderingSplitter(1);

    const { run, packages } = pipelineOver(
      aPackageOf(scan, first, second),
      splitter,
    );
    await run();

    expect(splitter.asked.map(request => request.storageKey.value)).toEqual([
      first.storageKey.value,
      second.storageKey.value,
    ]);
    for (const stored of (await storedPackage(packages)).files) {
      expect(stored.pageCount).toBe(1);
    }
  });

  it('does not split again a file an earlier run already split', async () => {
    const splitter = new RenderingSplitter(2);
    const packages = new InMemoryPackages(
      aPackageOf(aFile('submission.pdf', ContentType.PDF)),
    );
    const handler = new RunVerificationHandler(
      packages,
      new SequentialIds(),
      splitter,
      new RecordingOcr(),
      new SegmenterCuttingAt(),
      new RecordingClassifier(),
      new NoFields(),
      new RecordingCrossChecker(),
    );

    await handler.execute(new RunVerificationCommand(PACKAGE_ID));
    await expect(
      handler.execute(new RunVerificationCommand(PACKAGE_ID)),
    ).rejects.toThrow(PackageNotStartableException);

    expect(splitter.asked).toHaveLength(1);
  });

  describe('reading a file into the documents it holds', () => {
    it('finds one document per boundary the segmenter named', async () => {
      const { run, packages } = pipelineOver(
        aPackageOf(aFile('submission.pdf', ContentType.PDF)),
        new RenderingSplitter(5),
        new RecordingOcr(),
        new SegmenterCuttingAt([2, 4]),
      );

      await run();

      expect(spansOf(await documentsAfter(packages))).toEqual([
        [1, 1],
        [2, 3],
        [4, 5],
      ]);
    });

    it('reads a container PDF holding several documents as several documents', async () => {
      const { run, packages } = pipelineOver(
        aPackageOf(aFile('submission.pdf', ContentType.PDF)),
        new RenderingSplitter(3),
        new RecordingOcr(),
        new SegmenterCuttingAt([2, 3]),
      );

      await run();

      expect(await documentsAfter(packages)).toHaveLength(3);
    });

    it('asks the segmenter only after every sheet of the file has been read', async () => {
      const segmenter = new SegmenterCuttingAt([2]);

      await pipelineOver(
        aPackageOf(aFile('submission.pdf', ContentType.PDF)),
        new RenderingSplitter(3),
        new RecordingOcr(),
        segmenter,
      ).run();

      const [asked] = segmenter.asked;
      expect(asked?.pages.map(page => page.text.value)).toEqual([
        expect.stringContaining('page_001.png'),
        expect.stringContaining('page_002.png'),
        expect.stringContaining('page_003.png'),
      ]);
    });

    it('offers the segmenter the types the governing profile expects, described', async () => {
      const segmenter = new SegmenterCuttingAt();

      await pipelineOver(
        aPackageOf(aFile('submission.pdf', ContentType.PDF)),
        new RenderingSplitter(2),
        new RecordingOcr(),
        segmenter,
      ).run();

      const offered = segmenter.asked[0]?.candidates ?? [];
      expect(offered.map(candidate => candidate.type.value)).toEqual(
        VerificationProfile.CADASTRE.documentTypes.map(type => type.value),
      );
      expect(offered.every(candidate => candidate.description.length > 0)).toBe(
        true,
      );
    });

    it('does not ask the segmenter about a file of a single sheet', async () => {
      const segmenter = new SegmenterCuttingAt();
      const { run, packages } = pipelineOver(
        aPackageOf(aFile('scan.jpg', ContentType.JPEG)),
        new RefusingSplitter(),
        new RecordingOcr(),
        segmenter,
      );

      await run();

      expect(segmenter.asked).toEqual([]);
      expect(spansOf(await documentsAfter(packages))).toEqual([[1, 1]]);
    });

    it('reads each file of a package into its own documents', async () => {
      const { run, packages } = pipelineOver(
        aPackageOf(
          aFile('first.pdf', ContentType.PDF),
          aFile('second.pdf', ContentType.PDF),
        ),
        new RenderingSplitter(2),
        new RecordingOcr(),
        new SegmenterCuttingAt([2]),
      );

      await run();

      const documents = await documentsAfter(packages);
      expect(documents).toHaveLength(4);
      expect(new Set(documents.map(d => d.sourceFileId.value)).size).toBe(2);
    });

    it('does not read again a file an earlier run already read', async () => {
      const segmenter = new SegmenterCuttingAt([2]);
      const packages = new InMemoryPackages(
        aPackageOf(aFile('submission.pdf', ContentType.PDF)),
      );
      const handler = new RunVerificationHandler(
        packages,
        new SequentialIds(),
        new RenderingSplitter(3),
        new RecordingOcr(),
        segmenter,
        new RecordingClassifier(),
        new NoFields(),
        new RecordingCrossChecker(),
      );

      await handler.execute(new RunVerificationCommand(PACKAGE_ID));
      await expect(
        handler.execute(new RunVerificationCommand(PACKAGE_ID)),
      ).rejects.toThrow(PackageNotStartableException);

      expect(segmenter.asked).toHaveLength(1);
      expect(await documentsAfter(packages)).toHaveLength(2);
    });
  });

  describe('holding the documents against each other', () => {
    const IDENTITY = VerificationProfile.CADASTRE.crossChecks[0]!;

    // The card on sheet 1, the application on sheet 2 — the two papers the
    // profile's first check reads the applicant's name off.
    class CardThenApplication extends DocumentClassifier {
      #placed = 0;

      override async classify(): Promise<Classification> {
        this.#placed += 1;

        return Classification.of(
          DocumentType.create(
            this.#placed === 1 ? 'identity_card' : 'application',
          ),
          Confidence.of(0.9),
        );
      }
    }

    class NamesOnTheDocument extends FieldExtractor {
      constructor(private readonly applicant = 'Əliyeva Rübabə') {
        super();
      }

      override async extract(
        request: ExtractionRequest,
      ): Promise<readonly ExtractedField[]> {
        const said =
          request.spec.type.value === 'identity_card'
            ? ([
                ['last_name', 'ƏLİYEVA'],
                ['first_name', 'Rübabə'],
              ] as const)
            : ([['applicant_name', this.applicant]] as const);

        return said.map(([key, value]) =>
          ExtractedField.of(
            FieldKey.create(key),
            FieldValue.create(value),
            Confidence.of(0.9),
            PageNumber.first(),
          ),
        );
      }
    }

    function aSubmission(
      crossChecker: CrossChecker = new RecordingCrossChecker(),
      extractor: FieldExtractor = new NamesOnTheDocument(),
    ) {
      return pipelineOver(
        aPackageOf(aFile('submission.pdf', ContentType.PDF)),
        new RenderingSplitter(2),
        new RecordingOcr(),
        new SegmenterCuttingAt([2]),
        new CardThenApplication(),
        extractor,
        crossChecker,
      );
    }

    it('asks about the check with every value the two documents offered', async () => {
      const crossChecker = new RecordingCrossChecker();

      await aSubmission(crossChecker).run();

      const asked = crossChecker.asked.find(
        request => request.spec.key.value === 'applicant_identity',
      );
      expect(asked?.values.map(value => value.value.value)).toEqual([
        'ƏLİYEVA',
        'Rübabə',
        'Əliyeva Rübabə',
      ]);
    });

    it('records what came back', async () => {
      const { run, packages } = aSubmission(
        new RecordingCrossChecker(CrossCheckVerdict.MISMATCH),
      );

      await run();

      const stored = await storedPackage(packages);
      expect(stored.hasMade(IDENTITY.key)).toBe(true);
      expect(stored.crossChecks[0]?.verdict).toBe(CrossCheckVerdict.MISMATCH);
    });

    it('never lets a check be surer than the least confident value it weighed', async () => {
      class AFaintCard extends NamesOnTheDocument {
        override async extract(
          request: ExtractionRequest,
        ): Promise<readonly ExtractedField[]> {
          const read = await super.extract(request);

          return read.map(field =>
            ExtractedField.of(
              field.key,
              field.value,
              Confidence.of(field.key.value === 'last_name' ? 0.4 : 0.9),
              field.foundOn,
            ),
          );
        }
      }

      const { run, packages } = aSubmission(
        new RecordingCrossChecker(),
        new AFaintCard(),
      );

      await run();

      expect(
        (await storedPackage(packages)).crossChecks[0]?.confidence.value,
      ).toBe(0.4);
    });

    it('asks about no check the package has only one document for', async () => {
      const crossChecker = new RecordingCrossChecker();

      await aSubmission(crossChecker).run();

      expect(crossChecker.asked.map(request => request.spec.key.value)).toEqual(
        ['applicant_identity'],
      );
    });

    it('does not ask again about a check an earlier run already made', async () => {
      const crossChecker = new RecordingCrossChecker();
      const packages = new InMemoryPackages(
        aPackageOf(aFile('submission.pdf', ContentType.PDF)),
      );
      const handler = new RunVerificationHandler(
        packages,
        new SequentialIds(),
        new RenderingSplitter(2),
        new RecordingOcr(),
        new SegmenterCuttingAt([2]),
        new CardThenApplication(),
        new NamesOnTheDocument(),
        crossChecker,
      );

      await handler.execute(new RunVerificationCommand(PACKAGE_ID));
      await expect(
        handler.execute(new RunVerificationCommand(PACKAGE_ID)),
      ).rejects.toThrow(PackageNotStartableException);

      expect(crossChecker.asked).toHaveLength(1);
    });

    it('carries on to the report when the check itself could not be made', async () => {
      class RefusingCrossChecker extends CrossChecker {
        override check(): Promise<CrossCheckAnswer> {
          throw new Error('no cross-check is made in this test');
        }
      }

      const { run, packages } = aSubmission(new RefusingCrossChecker());

      await run();

      const stored = await storedPackage(packages);
      expect(stored.crossChecks).toEqual([]);
      expect(stored.report).not.toBeNull();
      expect(stored.status.value).toBe('Completed');
    });

    it('puts a disagreement in the report it hands over', async () => {
      const { run, packages } = aSubmission(
        new RecordingCrossChecker(CrossCheckVerdict.MISMATCH),
      );

      await run();

      const kinds = (await storedPackage(packages)).report?.issues.map(
        issue => issue.kind.value,
      );
      expect(kinds).toContain('FieldMismatch');
    });
  });

  describe('classifying what was found', () => {
    it('tells the classifier what each candidate type is, not only its key', async () => {
      const classifier = new RecordingClassifier();

      await pipelineOver(
        aPackageOf(aFile('submission.pdf', ContentType.PDF)),
        new RenderingSplitter(2),
        new RecordingOcr(),
        new SegmenterCuttingAt(),
        classifier,
      ).run();

      const offered = classifier.asked[0]?.candidates ?? [];
      expect(offered.map(candidate => candidate.type.value)).toEqual(
        VerificationProfile.CADASTRE.documentTypes.map(type => type.value),
      );
      expect(offered.every(candidate => candidate.hints.length > 0)).toBe(true);
    });

    it('classifies every document, not every file', async () => {
      const classifier = new RecordingClassifier();
      const { run, packages } = pipelineOver(
        aPackageOf(aFile('submission.pdf', ContentType.PDF)),
        new RenderingSplitter(4),
        new RecordingOcr(),
        new SegmenterCuttingAt([3]),
        classifier,
      );

      await run();

      expect(classifier.asked).toHaveLength(2);
      for (const document of await documentsAfter(packages)) {
        expect(document.isClassified).toBe(true);
      }
    });

    it('classifies a document from the text of its own sheets alone', async () => {
      const file = aFile('submission.pdf', ContentType.PDF);
      const classifier = new RecordingClassifier();

      await pipelineOver(
        aPackageOf(file),
        new RenderingSplitter(3),
        new RecordingOcr(),
        new SegmenterCuttingAt([3]),
        classifier,
      ).run();

      const [first, second] = classifier.asked;
      expect(first?.text.value).toBe(
        `text of ${file.storageKey.value}/pages/page_001.png\n` +
          `text of ${file.storageKey.value}/pages/page_002.png`,
      );
      expect(second?.text.value).toBe(
        `text of ${file.storageKey.value}/pages/page_003.png`,
      );
    });

    it('completes the package once every document has been placed', async () => {
      const { run, packages } = pipelineOver(
        aPackageOf(aFile('submission.pdf', ContentType.PDF)),
        new RenderingSplitter(3),
        new RecordingOcr(),
        new SegmenterCuttingAt([2]),
      );

      await run();

      expect((await storedPackage(packages)).status.value).toBe('Completed');
    });
  });
});
