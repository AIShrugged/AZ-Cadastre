import type { ModuleMetadata } from "@nestjs/common";

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
    provider: "mock" | "openrouter";
    model: string;
    concurrency: number;
  };
  segmenter: {
    provider: "mock" | "openrouter";
    model: string;
  };
  classifier: {
    provider: "mock" | "openrouter";
    model: string;
  };
  extractor: {
    provider: "mock" | "openrouter";
    model: string;
  };
  crossChecker: {
    provider: "mock" | "openrouter";
    model: string;
  };
};

/** How `VerificationModule.forRootAsync` is handed that shape. */
export type VerificationModuleAsyncOptions = Pick<ModuleMetadata, "imports"> & {
  inject?: unknown[];
  useFactory: (
    ...args: never[]
  ) => VerificationModuleOptions | Promise<VerificationModuleOptions>;
};

/** Injection token for the resolved options. */
export const VERIFICATION_OPTIONS = "VERIFICATION_OPTIONS";
