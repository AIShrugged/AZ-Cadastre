import type { ModuleMetadata } from '@nestjs/common';

/**
 * The configuration this context needs, as a shape rather than as environment
 * variables. The composition root reads and validates the environment once and
 * hands a slice of this shape in; nothing under `packages/` reads
 * `process.env`.
 */
export type VerificationModuleOptions = {
  web: {
    // The browser origin the presigned uploads are PUT from, which is what the
    // bucket's CORS rule has to name.
    origin: string;
  };
  database: {
    url: string;
  };
  storage: {
    endpoint: string;
    region: string;
    bucket: string;
    accessKey: string;
    secretKey: string;
    forcePathStyle: boolean;
    // Seconds.
    presignTtl: number;
  };
  pdf: {
    pageDpi: number;
    maxPages: number;
  };
  openrouter: {
    apiKey: string | undefined;
    baseUrl: string;
    appTitle: string;
  };
  ocr: {
    provider: 'mock' | 'openrouter';
    model: string;
    concurrency: number;
  };
  segmenter: {
    provider: 'mock' | 'openrouter';
    model: string;
  };
  classifier: {
    provider: 'mock' | 'openrouter';
    model: string;
  };
  extractor: {
    provider: 'mock' | 'openrouter';
    model: string;
  };
  crossChecker: {
    provider: 'mock' | 'openrouter';
    model: string;
  };
  /*
   * Who reads the geometry of a drawing's sheets — the room outlines, the axes
   * and the dimension chain — for the markup an inspector checks the span
   * against (COMM-165).
   *
   * Its own model and not the extractor's, deliberately: `EXTRACTOR_MODEL` is
   * one setting for every type of paper, and the model that reads a passport
   * best does not read a dimension chain at all (docs/MODELS.md). `mock` draws
   * a fixed demo plan, which is what makes the stage exercisable with no key.
   */
  geometry: {
    provider: 'mock' | 'openrouter';
    model: string;
  };
  // The archive register the property is looked up in. `mock` answers from the
  // stand-in built into the context and needs no process; `http` calls whoever
  // serves the register contract — today `apps/registry-stub` (ADR-0009).
  registry: {
    provider: 'mock' | 'http';
    url: string;
    timeoutMs: number;
  };
  // The National Archive Fund, asked by the QR code decoded off a paper
  // (ADR-0028, ADR-0034). `mock` answers from the stand-in built into the
  // context, which holds one paper; `http` asks the archive's own electronic
  // document service, which says who signed a certified copy and whether the
  // signature verifies.
  nationalArchive: {
    provider: 'mock' | 'http';
    url: string;
    // What the service itself is given to answer the metadata question in.
    timeoutMs: number;
    /*
     * What following the answer's link to the signed copy is given (COMM-153).
     *
     * Its own budget and not the one above. The metadata call is a few hundred
     * bytes off the service's own API and answers in under a second; the link
     * is a presigned download off S3, and the file behind it is whatever the
     * archive scanned — two born-digital pages on the Hümbətov order, tens of
     * scanned ones on an older holding. Measured against the live service on
     * 23 September 2026 the metadata took 0.7s and a 202 KB copy 1.4–1.8s, of
     * which 0.85s was the connection; at that throughput a copy of a few
     * megabytes does not finish inside five seconds, and a copy that times out
     * reaches the inspector as eight lines the archive "states nothing" on.
     */
    copyTimeoutMs: number;
  };
};

/** How `VerificationModule.forRootAsync` is handed that shape. */
export type VerificationModuleAsyncOptions = Pick<ModuleMetadata, 'imports'> & {
  inject?: unknown[];
  useFactory: (
    ...args: never[]
  ) => VerificationModuleOptions | Promise<VerificationModuleOptions>;
};

/** Injection token for the resolved options. */
export const VERIFICATION_OPTIONS = 'VERIFICATION_OPTIONS';
