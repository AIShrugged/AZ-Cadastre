import { describe, expect, it } from "vitest";

import { VerificationPackage } from "../../../domain/aggregates/index.js";
import { Document, type ExtractedField } from "../../../domain/entities/index.js";
import { PackageNotStartableException } from "../../../domain/exceptions/index.js";
import { VerificationPackageRepository } from "../../../domain/repositories/index.js";
import {
  Classification,
  Confidence,
  ContentType,
  DocumentId,
  DocumentType,
  Filename,
  OcrResult,
  PackageId,
  PageId,
  PageImage,
  PageNumber,
  RecognisedText,
  StorageKey,
  VerificationProfile,
} from "../../../domain/value-objects/index.js";
import {
  DocumentClassifier,
  FieldExtractor,
  IdGenerator,
  OcrProvider,
  PdfSplitter,
  type PdfSplitRequest,
  type SplitPage,
} from "../../ports/index.js";
import { RunVerificationCommand } from "./run-verification.command.js";
import { RunVerificationHandler } from "./run-verification.handler.js";

const PACKAGE_ID = "0190a1b2-c3d4-7e5f-8a9b-000000000001";

let sequence = 0;

function anId(): string {
  sequence += 1;
  return `0190a1b2-c3d4-7e5f-8a9b-${sequence.toString(16).padStart(12, "0")}`;
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

  override async split(request: PdfSplitRequest): Promise<readonly SplitPage[]> {
    this.asked.push(request);

    return Array.from({ length: this.sheets }, (_, index) => ({
      number: PageNumber.of(index + 1),
      image: PageImage.of(
        StorageKey.create(
          `${request.storageKey.value}/pages/page_${String(index + 1).padStart(3, "0")}.png`,
        ),
        ContentType.PNG,
      ),
    }));
  }
}

class RefusingSplitter extends PdfSplitter {
  override split(): Promise<readonly SplitPage[]> {
    throw new Error("no PDF is split in this test");
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
    await new Promise((resolve) => setTimeout(resolve, 0));
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

class FixedClassifier extends DocumentClassifier {
  override async classify(): Promise<Classification> {
    return Classification.of(
      DocumentType.create("passport"),
      Confidence.of(0.9),
    );
  }
}

class NoFields extends FieldExtractor {
  override async extract(): Promise<readonly ExtractedField[]> {
    return [];
  }
}

function aPackageOf(...documents: readonly Document[]): VerificationPackage {
  return VerificationPackage.create(
    PackageId.of(PACKAGE_ID),
    VerificationProfile.CADASTRE,
    documents,
  );
}

function aDocument(filename: string, contentType: ContentType): Document {
  return Document.create(
    DocumentId.of(anId()),
    Filename.create(filename),
    contentType,
    StorageKey.create(`${anId()}/${filename}`),
  );
}

function pipelineOver(
  verification: VerificationPackage,
  pdf: PdfSplitter,
  ocr: RecordingOcr = new RecordingOcr(),
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
    new FixedClassifier(),
    new NoFields(),
  );

  return {
    run: () => handler.execute(new RunVerificationCommand(PACKAGE_ID)),
    packages,
    ocr,
  };
}

async function documentsAfter(
  packages: InMemoryPackages,
): Promise<readonly Document[]> {
  return (await packages.findById())!.documents;
}

describe("RunVerificationHandler", () => {
  it("makes a page of every sheet the PDF was split into", async () => {
    const verification = aPackageOf(
      aDocument("passport.pdf", ContentType.PDF),
    );
    const { run, packages } = pipelineOver(verification, new RenderingSplitter(3));

    await run();

    const [document] = await documentsAfter(packages);
    expect(document?.pages.map((page) => page.number.value)).toEqual([1, 2, 3]);
  });

  it("gives each page the image the splitter rendered for it", async () => {
    const document = aDocument("passport.pdf", ContentType.PDF);
    const { run, packages } = pipelineOver(
      aPackageOf(document),
      new RenderingSplitter(2),
    );

    await run();

    const [stored] = await documentsAfter(packages);
    expect(stored?.pages.map((page) => page.image.storageKey.value)).toEqual([
      `${document.storageKey.value}/pages/page_001.png`,
      `${document.storageKey.value}/pages/page_002.png`,
    ]);
  });

  it("splits the PDF once, by the key the file was uploaded under", async () => {
    const document = aDocument("deed.pdf", ContentType.PDF);
    const splitter = new RenderingSplitter(2);

    await pipelineOver(aPackageOf(document), splitter).run();

    expect(splitter.asked).toEqual([{ storageKey: document.storageKey }]);
  });

  it("reads every sheet of a PDF, each as the PNG it was rendered to", async () => {
    const { run, ocr } = pipelineOver(
      aPackageOf(aDocument("passport.pdf", ContentType.PDF)),
      new RenderingSplitter(3),
    );

    await run();

    expect(ocr.read).toHaveLength(3);
    for (const image of ocr.read) {
      expect(image.contentType.equals(ContentType.PNG)).toBe(true);
    }
  });

  it("reads the pages of one document at the same time, not one after another", async () => {
    const { run, ocr } = pipelineOver(
      aPackageOf(aDocument("passport.pdf", ContentType.PDF)),
      new RenderingSplitter(4),
    );

    await run();

    expect(ocr.peakInFlight).toBe(4);
  });

  it("reads no more pages at once than the provider says it will take", async () => {
    const ocr = new RecordingOcr(2);
    const { run, packages } = pipelineOver(
      aPackageOf(aDocument("passport.pdf", ContentType.PDF)),
      new RenderingSplitter(5),
      ocr,
    );

    await run();

    expect(ocr.peakInFlight).toBe(2);
    const [document] = await documentsAfter(packages);
    expect(document?.pages.every((page) => page.isRecognised)).toBe(true);
  });

  it("keeps the readings it got when one page of the batch fails", async () => {
    const refusesPageTwo = (image: PageImage) =>
      image.storageKey.value.endsWith("page_002.png");
    const { run, packages } = pipelineOver(
      aPackageOf(aDocument("passport.pdf", ContentType.PDF)),
      new RenderingSplitter(3),
      new RecordingOcr(8, refusesPageTwo),
    );

    await expect(run()).rejects.toThrow("no reading of");

    const verification = (await packages.findById())!;
    expect(verification.status.value).toBe("Failed");
    expect(
      verification.documents[0]?.pages.map((page) => page.isRecognised),
    ).toEqual([true, false, true]);
  });

  it("asks the provider only for the pages a failed run left unread", async () => {
    const document = aDocument("passport.pdf", ContentType.PDF);
    const refusesPageTwo = (image: PageImage) =>
      image.storageKey.value.endsWith("page_002.png");
    const packages = new InMemoryPackages(aPackageOf(document));
    const pipeline = (ocr: RecordingOcr) =>
      new RunVerificationHandler(
        packages,
        new SequentialIds(),
        new RenderingSplitter(3),
        ocr,
        new FixedClassifier(),
        new NoFields(),
      ).execute(new RunVerificationCommand(PACKAGE_ID));

    await expect(pipeline(new RecordingOcr(8, refusesPageTwo))).rejects.toThrow(
      "no reading of",
    );
    const second = new RecordingOcr();
    await pipeline(second);

    expect(second.read.map((image) => image.storageKey.value)).toEqual([
      `${document.storageKey.value}/pages/page_002.png`,
    ]);
    expect((await packages.findById())!.status.value).toBe("Completed");
  });

  it("takes a photographed document as the single page it already is", async () => {
    const document = aDocument("scan.jpg", ContentType.JPEG);
    const { run, packages } = pipelineOver(
      aPackageOf(document),
      new RefusingSplitter(),
    );

    await run();

    const [stored] = await documentsAfter(packages);
    expect(stored?.pages).toHaveLength(1);
    expect(stored?.pages[0]?.image.storageKey.equals(document.storageKey)).toBe(
      true,
    );
    expect(stored?.pages[0]?.image.contentType.equals(ContentType.JPEG)).toBe(
      true,
    );
  });

  it("splits the PDFs of a package and leaves its images alone", async () => {
    const scan = aDocument("scan.png", ContentType.PNG);
    const first = aDocument("passport.pdf", ContentType.PDF);
    const second = aDocument("application.pdf", ContentType.PDF);
    const splitter = new RenderingSplitter(1);

    const { run, packages } = pipelineOver(
      aPackageOf(scan, first, second),
      splitter,
    );
    await run();

    expect(splitter.asked.map((request) => request.storageKey.value)).toEqual([
      first.storageKey.value,
      second.storageKey.value,
    ]);
    for (const document of await documentsAfter(packages)) {
      expect(document.pages).toHaveLength(1);
    }
  });

  it("does not split again a document an earlier run already split", async () => {
    const splitter = new RenderingSplitter(2);
    const verification = aPackageOf(aDocument("passport.pdf", ContentType.PDF));
    const packages = new InMemoryPackages(verification);
    const handler = new RunVerificationHandler(
      packages,
      new SequentialIds(),
      splitter,
      new RecordingOcr(),
      new FixedClassifier(),
      new NoFields(),
    );

    await handler.execute(new RunVerificationCommand(PACKAGE_ID));
    await expect(
      handler.execute(new RunVerificationCommand(PACKAGE_ID)),
    ).rejects.toThrow(PackageNotStartableException);

    expect(splitter.asked).toHaveLength(1);
  });
});
