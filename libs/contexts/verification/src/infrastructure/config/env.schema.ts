import { z } from "zod";

export const EnvironmentSchema = z
  .object({
    DATABASE_URL: z.url().default(
      "postgresql://postgres:postgres@localhost:5432/cadastre-db?schema=public",
    ),

    WEB_ORIGIN: z.string().nonempty().default("http://localhost:5173"),

    // Reachable from both this service and the browser: the presigned URL points
    // straight at it.
    S3_ENDPOINT: z.string().nonempty().default("http://localhost:9000"),
    S3_REGION: z.string().nonempty().default("rustfs"),
    S3_BUCKET: z.string().nonempty().default("documents"),
    S3_ACCESS_KEY: z.string().nonempty(),
    S3_SECRET_KEY: z.string().nonempty(),
    S3_FORCE_PATH_STYLE: z
      .enum(["true", "false"])
      .default("true")
      .transform((v) => v === "true"),
    // Seconds.
    S3_PRESIGN_TTL: z.coerce.number().int().positive().default(600),

    // Resolution every PDF page is rendered at before OCR reads it. Higher
    // reads small print better and costs more bytes per page.
    PDF_PAGE_DPI: z.coerce.number().int().positive().default(150),
    // The pipeline runs in-process (ADR-0001), so one upload cannot be allowed
    // to occupy it indefinitely.
    PDF_MAX_PAGES: z.coerce.number().int().positive().default(30),

    // Required only when a provider below is set to "openrouter", which is where
    // its absence is refused.
    OPENROUTER_API_KEY: z.string().optional(),
    OPENROUTER_BASE_URL: z.string().default("https://openrouter.ai/api/v1"),
    OPENROUTER_APP_TITLE: z.string().default("AZ-Cadastre"),

    OCR_PROVIDER: z.enum(["mock", "openrouter"]).default("mock"),
    OCR_MODEL: z.string().default("google/gemini-2.5-flash"),
    // Pages read at once. Raise it to get through a long PDF faster, lower it if
    // the provider starts answering with rate limits.
    OCR_CONCURRENCY: z.coerce.number().int().positive().default(4),

    CLASSIFIER_PROVIDER: z.enum(["mock", "openrouter"]).default("mock"),
    CLASSIFIER_MODEL: z.string().default("google/gemini-2.5-flash"),

    EXTRACTOR_PROVIDER: z.enum(["mock", "openrouter"]).default("mock"),
    EXTRACTOR_MODEL: z.string().default("google/gemini-2.5-flash"),
  })
  .transform((env) => ({
    web: {
      origin: env.WEB_ORIGIN,
    },
    database: {
      url: env.DATABASE_URL,
    },
    storage: {
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      bucket: env.S3_BUCKET,
      accessKey: env.S3_ACCESS_KEY,
      secretKey: env.S3_SECRET_KEY,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      presignTtl: env.S3_PRESIGN_TTL,
    },
    pdf: {
      pageDpi: env.PDF_PAGE_DPI,
      maxPages: env.PDF_MAX_PAGES,
    },
    openrouter: {
      apiKey: env.OPENROUTER_API_KEY,
      baseUrl: env.OPENROUTER_BASE_URL,
      appTitle: env.OPENROUTER_APP_TITLE,
    },
    ocr: {
      provider: env.OCR_PROVIDER,
      model: env.OCR_MODEL,
      concurrency: env.OCR_CONCURRENCY,
    },
    classifier: {
      provider: env.CLASSIFIER_PROVIDER,
      model: env.CLASSIFIER_MODEL,
    },
    extractor: {
      provider: env.EXTRACTOR_PROVIDER,
      model: env.EXTRACTOR_MODEL,
    },
  }));

export type Environment = z.infer<typeof EnvironmentSchema>;
