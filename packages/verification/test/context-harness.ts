import { CqrsModule, type QueryBus } from '@nestjs/cqrs';
import { Test, type TestingModule } from '@nestjs/testing';

import type {
  AddressLookupRequest,
  AddressLookupResponse,
} from '@cadastre/api-contracts/registry';
import { LoggerModule } from '@cadastre/logger';

import {
  ArchiveRegistryPort,
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
import { ArchiveRegistryAdapter } from '../src/infrastructure/adapters/index.js';
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
  // The two papers the register stage holds against the record: the certificate
  // names the owner, the plan-scheme carries the cadastral number and the area.
  if (key.includes('arxiv'))
    return 'ARXİV ARAYIŞI\nArayış No: ARX-2025-0417\nMülkiyyətçi: ELÇİN ƏLİYEV';
  if (key.includes('plan'))
    return 'TORPAQ SAHƏSİNİN PLAN-SXEMİ\nKadastr nömrəsi: AZ-CAD-1024-311\nSahə: 642 m²';
  return `SƏNƏD\nİstinad: ${key}`;
}

export type Harness = {
  readonly module: TestingModule;
  readonly storage: InMemoryObjectStorage;
};

/**
 * What a spec may swap out. Only the ports that would leave the process are
 * offered: everything else — the buses, the handlers, the repository, Prisma —
 * stays the real thing, which is the point of the set.
 */
export type Overrides = {
  readonly ocr?: OcrProvider;
  readonly splitter?: PdfSplitter;
  readonly storage?: InMemoryObjectStorage;
  readonly registry?: ArchiveRegistryPort;
};

/**
 * A register that answers whatever a spec needs it to. The stand-in built into
 * the context holds the offline demo property and confirms it, which is a run
 * with nothing to report — so a spec about what the register *found* supplies
 * its own (ADR-0009).
 */
export class StubRegistry extends ArchiveRegistryPort {
  readonly asked: string[] = [];

  constructor(private readonly answer: AddressLookupResponse) {
    super();
  }

  override readonly addresses = {
    lookup: async (
      request: AddressLookupRequest,
    ): Promise<AddressLookupResponse> => {
      this.asked.push(request.address);

      return {
        ...this.answer,
        attributes: request.attributes.map((attribute, index) => ({
          name: attribute.name,
          match: this.answer.attributes[index]?.match ?? 'NotRecorded',
          submitted: attribute.value,
          recorded: this.answer.attributes[index]?.recorded ?? null,
        })),
      };
    },
  };
}

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
    // No register process in this set: the stand-in built into the context
    // answers unless a spec overrides the port with one of its own.
    registry: { provider: 'mock', url: '', timeoutMs: 1000 },
  };
}

/**
 * The context as the composition root assembles it, with the two ports that
 * would reach out of the process replaced. Everything else — the buses, the
 * handlers, the repository, Prisma — is the real thing against the real
 * database.
 */
export async function startContext(
  databaseUrl: string,
  overrides: Overrides = {},
): Promise<Harness> {
  const storage = overrides.storage ?? new InMemoryObjectStorage();

  const module = await Test.createTestingModule({
    imports: [
      CqrsModule.forRoot(),
      /*
       * The composition root registers this globally, so the context is
       * assembled here the same way it is there. Silent by default — a set
       * that prints a pipeline run per spec is a set nobody reads — but
       * LOG_LEVEL turns it back on, which is the fastest way to see what a
       * failing integration spec actually did.
       */
      LoggerModule.forRoot({
        service: 'verification-test',
        level: process.env.LOG_LEVEL ?? 'silent',
        pretty: true,
      }),
      VerificationModule.forRootAsync({
        useFactory: () => testOptions(databaseUrl),
      }),
    ],
  })
    .overrideProvider(ObjectStorage)
    .useValue(storage)
    .overrideProvider(PdfSplitter)
    .useValue(overrides.splitter ?? new FixedPageSplitter())
    .overrideProvider(OcrProvider)
    .useValue(overrides.ocr ?? new InstantOcr())
    .overrideProvider(ArchiveRegistryPort)
    .useValue(overrides.registry ?? new ArchiveRegistryAdapter())
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

/**
 * A reader that never manages to read, and counts how many times it was asked.
 *
 * The recognise stage retries a refused sheet up to ATTEMPTS_PER_SHEET times
 * and then gives up on it, so the count is the budget: it is what stops a
 * provider having a bad minute from costing a run, and what stops a provider
 * that is simply down from costing it forever.
 */
export class UnreadableOcr extends OcrProvider {
  override readonly pagesAtOnce = 8;

  #attempts = 0;

  get attempts(): number {
    return this.#attempts;
  }

  async recognise(image: PageImage): Promise<OcrResult> {
    this.#attempts += 1;
    throw new Error(`the reader is down (asked for ${image.storageKey.value})`);
  }
}
