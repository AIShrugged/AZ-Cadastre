import { CqrsModule, type QueryBus } from '@nestjs/cqrs';
import { Test, type TestingModule } from '@nestjs/testing';

import {
  ObjectStorage,
  OcrProvider,
  PdfSplitter,
  type PresignedDownload,
  type PresignedUpload,
  type PresignUploadRequest,
  type PutObjectRequest,
  type StoredObject,
} from '../src/application/ports/outbound/index.js';
import type { PackageSummaryView } from '../src/application/read-models/index.js';
import { GetPackageSummaryQuery } from '../src/application/use-cases/packages/index.js';
import {
  Confidence,
  ContentType,
  OcrResult,
  PackageStatus,
  PageImage,
  PageNumber,
  RecognisedText,
  StorageKey,
  type PackageId,
} from '../src/domain/value-objects/index.js';
import type { VerificationModuleOptions } from '../src/verification.module-defs.js';
import { VerificationModule } from '../src/verification.module.js';

/**
 * The bucket, in a Map. Every method the context actually calls is implemented
 * and nothing else is: a port method that grows a caller should fail loudly
 * here rather than quietly answer `undefined`.
 */
export class InMemoryObjectStorage extends ObjectStorage {
  readonly objects = new Map<string, { body: Buffer; contentType: string }>();

  async presignUpload(request: PresignUploadRequest): Promise<PresignedUpload> {
    const key = `uploads/${this.objects.size}/${request.filename.value}`;
    return {
      key: StorageKey.create(key),
      url: `memory://${key}`,
      contentType: request.contentType,
      expiresIn: 900,
    };
  }

  async putObject(request: PutObjectRequest): Promise<void> {
    this.objects.set(request.key.value, {
      body: Buffer.from(request.body),
      contentType: request.contentType.value,
    });
  }

  async presignDownload(key: StorageKey): Promise<PresignedDownload> {
    return { url: `memory://${key.value}`, expiresIn: 900 };
  }

  async getObject(key: StorageKey): Promise<StoredObject> {
    const stored = this.objects.get(key.value);
    if (!stored) throw new Error(`nothing stored at ${key.value}`);
    return {
      body: stored.body,
      contentType: ContentType.of(stored.contentType),
    };
  }
}

/**
 * A splitter that does not open a PDF. What is under test on this side of the
 * context is the aggregate and its mapping, not pdfjs — so a source file
 * becomes a fixed number of pages whose storage keys carry the original
 * filename, which is what the offline OCR keys its text off.
 */
export class FixedPageSplitter extends PdfSplitter {
  constructor(private readonly pagesPerFile = 2) {
    super();
  }

  async split(request: { storageKey: StorageKey }) {
    return Array.from({ length: this.pagesPerFile }, (_, index) => ({
      number: PageNumber.of(index + 1),
      image: PageImage.of(
        StorageKey.create(`${request.storageKey.value}/page-${index + 1}.png`),
        ContentType.of('image/png'),
      ),
    }));
  }
}

/** The offline OCR without its 1.2s-per-page demo latency. */
export class InstantOcr extends OcrProvider {
  override readonly pagesAtOnce = 8;

  async recognise(image: PageImage): Promise<OcrResult> {
    return OcrResult.of(
      RecognisedText.of(textFor(image.storageKey.value)),
      Confidence.of(0.9),
    );
  }
}

/** Enough of a real page for the profile's headings to classify it. */
function textFor(key: string): string {
  if (key.includes('vesiqe'))
    return 'ŞƏXSİYYƏT VƏSİQƏSİ\nSoyadı: ƏLİYEV\nAdı: ELÇİN\nVəsiqə No: AZE1234567';
  if (key.includes('erize'))
    return 'DÖVLƏT QEYDİYYATI HAQQINDA ƏRİZƏ\nƏrizəçi: ELÇİN ƏLİYEV\nŞəxsiyyət vəsiqəsi No: AZE1234567';
  return `SƏNƏD\nİstinad: ${key}`;
}

export type Harness = {
  readonly module: TestingModule;
  readonly storage: InMemoryObjectStorage;
};

export function testOptions(databaseUrl: string): VerificationModuleOptions {
  return {
    web: { origin: 'http://localhost:5173' },
    database: { url: databaseUrl },
    storage: {
      endpoint: 'http://localhost:9000',
      region: 'us-east-1',
      bucket: 'test',
      accessKey: 'test',
      secretKey: 'test',
      forcePathStyle: true,
      presignTtl: 900,
    },
    pdf: { pageDpi: 96, maxPages: 20 },
    openrouter: { apiKey: undefined, baseUrl: '', appTitle: 'test' },
    // Offline everywhere: the model-backed adapters are what an API-level set
    // would exercise, and a unit test already covers how each reads an answer.
    ocr: { provider: 'mock', model: '', concurrency: 4 },
    segmenter: { provider: 'mock', model: '' },
    classifier: { provider: 'mock', model: '' },
    extractor: { provider: 'mock', model: '' },
    crossChecker: { provider: 'mock', model: '' },
  };
}

/**
 * The context as the composition root assembles it, with the two ports that
 * would reach out of the process replaced. Everything else — the buses, the
 * handlers, the repository, Prisma — is the real thing against the real
 * database.
 */
export async function startContext(databaseUrl: string): Promise<Harness> {
  const storage = new InMemoryObjectStorage();

  const module = await Test.createTestingModule({
    imports: [
      CqrsModule.forRoot(),
      VerificationModule.forRootAsync({
        useFactory: () => testOptions(databaseUrl),
      }),
    ],
  })
    .overrideProvider(ObjectStorage)
    .useValue(storage)
    .overrideProvider(PdfSplitter)
    .useValue(new FixedPageSplitter())
    .overrideProvider(OcrProvider)
    .useValue(new InstantOcr())
    .compile();

  await module.init();

  return { module, storage };
}

/**
 * Submitting a package raises PackageSubmitted, and the context reacts to it by
 * starting the run — fire and forget, because the pipeline outlives the request
 * that asked for it. A test that asserts on a package therefore has to wait for
 * that run to settle, or it is racing the context rather than testing it.
 */
export async function waitForTerminalStatus(
  queries: QueryBus,
  id: PackageId,
  timeoutMs = 30_000,
): Promise<PackageSummaryView> {
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const summary: PackageSummaryView = await queries.execute(
      new GetPackageSummaryQuery(id.value),
    );

    if (
      summary.status === PackageStatus.COMPLETED.value ||
      summary.status === PackageStatus.FAILED.value
    ) {
      return summary;
    }

    if (Date.now() > deadline) {
      throw new Error(
        `package ${id.value} was still ${summary.status} after ${timeoutMs}ms`,
      );
    }

    await new Promise(resolve => setTimeout(resolve, 50));
  }
}
