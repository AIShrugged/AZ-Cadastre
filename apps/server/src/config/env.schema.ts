import { z } from 'zod';

import type { LoggerModuleOptions } from '@cadastre/logger';
import type { VerificationModuleOptions } from '@cadastre/verification';

/**
 * The whole environment, validated once at startup and typed thereafter. This
 * is the only schema in the system that reads `process.env`: each module is
 * handed the slice below that it needs, and never looks the variables up
 * itself.
 */
export const EnvironmentSchema = z
  .object({
    SERVICE_PORT: z.coerce.number().int().positive().default(3000),
    SERVICE_HOST: z.string().nonempty().default('0.0.0.0'),

    DATABASE_URL: z
      .url()
      .default(
        'postgresql://postgres:postgres@localhost:5432/cadastre-db?schema=public',
      ),

    WEB_ORIGIN: z.string().nonempty().default('http://localhost:5173'),

    // ── Logging ───────────────────────────────────────────────────────────
    // Everything the service has to say goes to the console as one structured
    // line per event (ADR-0008). `debug` adds every SQL statement the context
    // runs and every prompt the pipeline sends; `info` is the run itself.
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    // Colourised and indented for a terminal. Turn it off in a container: one
    // JSON object per line is what a collector can read.
    LOG_PRETTY: z
      .enum(['true', 'false'])
      .default('true')
      .transform(v => v === 'true'),

    // Reachable from both this service and the browser: the presigned URL points
    // straight at it.
    S3_ENDPOINT: z.string().nonempty().default('http://localhost:9000'),
    S3_REGION: z.string().nonempty().default('rustfs'),
    S3_BUCKET: z.string().nonempty().default('documents'),
    S3_ACCESS_KEY: z.string().nonempty(),
    S3_SECRET_KEY: z.string().nonempty(),
    S3_FORCE_PATH_STYLE: z
      .enum(['true', 'false'])
      .default('true')
      .transform(v => v === 'true'),
    // Seconds.
    S3_PRESIGN_TTL: z.coerce.number().int().positive().default(600),

    // Resolution every PDF page is rendered at before OCR reads it. Higher
    // reads small print better and costs more bytes per page. 300 is not a
    // margin of comfort here: an identity card occupies about a quarter of the
    // A4 sheet it was photocopied onto, so at 150 its card number is some 40
    // pixels wide and every reader tested invented one. See docs/MODELS.md.
    PDF_PAGE_DPI: z.coerce.number().int().positive().default(300),
    // The pipeline runs in-process (ADR-0001), so one upload cannot be allowed
    // to occupy it indefinitely.
    PDF_MAX_PAGES: z.coerce.number().int().positive().default(30),

    // Required only when a provider below is set to "openrouter", which is where
    // its absence is refused.
    OPENROUTER_API_KEY: z.string().optional(),
    OPENROUTER_BASE_URL: z.string().default('https://openrouter.ai/api/v1'),
    OPENROUTER_APP_TITLE: z.string().default('AZ-Cadastre'),

    // Every default below is a model observed to return usable token logprobs
    // through OpenRouter, because a confidence the engine cannot obtain is a
    // confidence it would otherwise invent. docs/MODELS.md records what each
    // candidate actually answered and how to check a new one.
    OCR_PROVIDER: z.enum(['mock', 'openrouter']).default('mock'),
    OCR_MODEL: z.string().default('qwen/qwen2.5-vl-72b-instruct'),
    // Pages read at once. Raise it to get through a long PDF faster, lower it if
    // the provider starts answering with rate limits.
    OCR_CONCURRENCY: z.coerce.number().int().positive().default(4),

    // Reads an uploaded file into the documents it holds. A container PDF is
    // only as good as this boundary call, so it is worth pointing at a real
    // model even when the rest of the pipeline is mocked.
    SEGMENTER_PROVIDER: z.enum(['mock', 'openrouter']).default('mock'),
    SEGMENTER_MODEL: z.string().default('openai/gpt-4o'),

    CLASSIFIER_PROVIDER: z.enum(['mock', 'openrouter']).default('mock'),
    CLASSIFIER_MODEL: z.string().default('openai/gpt-4o'),

    // Reads the sheets as pictures as well as transcriptions, so it wants a
    // model that takes images.
    EXTRACTOR_PROVIDER: z.enum(['mock', 'openrouter']).default('mock'),
    EXTRACTOR_MODEL: z.string().default('qwen/qwen2.5-vl-72b-instruct'),

    // Holds the documents against each other: whether the name on the identity
    // card is the name the application is made in. It sees only the values the
    // extractor already read, so it is a text model and a cheap call — but it
    // is a judgement about names and addresses in two scripts, so it wants a
    // model that reads Azerbaijani rather than the smallest one available.
    CROSS_CHECKER_PROVIDER: z.enum(['mock', 'openrouter']).default('mock'),
    CROSS_CHECKER_MODEL: z.string().default('openai/gpt-4o'),
  })
  .transform(env => ({
    service: {
      host: env.SERVICE_HOST,
      port: env.SERVICE_PORT,
    },
    web: {
      origin: env.WEB_ORIGIN,
    },
    logger: {
      // The name on every line. One process today; when a context is extracted
      // into its own, this is what tells two logs apart.
      service: 'server',
      level: env.LOG_LEVEL,
      pretty: env.LOG_PRETTY,
    } satisfies LoggerModuleOptions,
    // The slice handed to `VerificationModule.forRootAsync`. Its shape is the
    // context's `VerificationModuleOptions`, which is what the compiler checks.
    verification: {
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
      segmenter: {
        provider: env.SEGMENTER_PROVIDER,
        model: env.SEGMENTER_MODEL,
      },
      classifier: {
        provider: env.CLASSIFIER_PROVIDER,
        model: env.CLASSIFIER_MODEL,
      },
      extractor: {
        provider: env.EXTRACTOR_PROVIDER,
        model: env.EXTRACTOR_MODEL,
      },
      crossChecker: {
        provider: env.CROSS_CHECKER_PROVIDER,
        model: env.CROSS_CHECKER_MODEL,
      },
    } satisfies VerificationModuleOptions,
  }));

export type Environment = z.infer<typeof EnvironmentSchema>;
