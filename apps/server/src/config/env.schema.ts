import { randomBytes } from 'node:crypto';

import { z } from 'zod';

import {
  DEFAULT_SEED_PASSWORD,
  type AccountsModuleOptions,
} from '@cadastre/accounts';
import { PASSWORD_MIN_LENGTH } from '@cadastre/api-contracts/accounts';
import type { SessionOptions } from '@cadastre/api-gateway';
import type { LoggerModuleOptions } from '@cadastre/logger';
import type { VerificationModuleOptions } from '@cadastre/verification';

import type { RegistryClientOptions } from '../infrastructure/registry/index.js';

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

    // The accounts context owns a database of its own, and deliberately not
    // this one: a context owns its database, and two of them sharing one is how
    // a join across the boundary gets written by accident (ADR-0029).
    ACCOUNTS_DATABASE_URL: z
      .url()
      .default(
        'postgresql://postgres:postgres@localhost:5432/cadastre-accounts?schema=public',
      ),

    // ── Sessions ──────────────────────────────────────────────────────────
    // The key every session cookie is signed with. Optional here and generated
    // when it is absent, which is the right trade for a developer — a stack
    // that has never been configured still signs in — and the wrong one for a
    // deployment: the generated key lives in one process's memory, so a restart
    // signs everybody out and a second replica accepts nothing the first one
    // issued. The start-up line says which of the two happened.
    SESSION_SECRET: z.string().min(16).optional(),
    // Seconds. A week: long enough that an operator is not signing in twice a
    // day, short enough that a token taken off a laptop stops working.
    SESSION_TTL: z.coerce
      .number()
      .int()
      .positive()
      .default(7 * 24 * 60 * 60),
    // `Secure` on the session cookie. False by default because the default
    // stand is plain HTTP, and a `Secure` cookie there is one the browser never
    // sends back — a sign-in that appears to work and then 401s. True anywhere
    // there is TLS.
    SESSION_COOKIE_SECURE: z
      .enum(['true', 'false'])
      .default('false')
      .transform(v => v === 'true'),

    // ── Seed accounts ─────────────────────────────────────────────────────
    // The two accounts the office starts with — `cadastre-operator` and
    // `cadastre-user` — so that a stack brought up from nothing can be signed
    // into. The logins are fixed in the context; only the passwords are
    // configured, and only here.
    //
    // They default, and the default is published in this repository. That is
    // the trade COMM-118 asked for and it is the right one for this product:
    // `pnpm dev` and `docker compose up` on a fresh clone have to produce a
    // stack somebody can sign into with no file to edit first, because the
    // alternative is a stand that migrated, seeded nothing, and is diagnosed at
    // the sign-in screen by somebody with no reason to suspect the environment.
    // What it costs — a known password on any stand whose operator did not
    // override it — is said out loud at start-up, by the seeder, naming the
    // variable below.
    //
    // Held to the same floor a registration is — from the contract's own
    // constant, so the office cannot be seeded with a password the public form
    // would have refused. That floor is eight because this default is.
    SEED_OPERATOR_PASSWORD: z
      .string()
      .min(PASSWORD_MIN_LENGTH)
      .default(DEFAULT_SEED_PASSWORD),
    SEED_USER_PASSWORD: z
      .string()
      .min(PASSWORD_MIN_LENGTH)
      .default(DEFAULT_SEED_PASSWORD),

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

    // Reads the geometry of a design set's sheets — room outlines, axes and the
    // dimension chain — for the markup an inspector checks the span against
    // (COMM-165). Its own model and not the extractor's: `EXTRACTOR_MODEL` is
    // one setting for every type of paper, and `qwen2.5-vl-72b` does not read a
    // dimension chain at all, while `gemini-2.5-pro` does (docs/MODELS.md). It
    // wants a model that takes images and answers in coordinates.
    GEOMETRY_PROVIDER: z.enum(['mock', 'openrouter']).default('mock'),
    GEOMETRY_MODEL: z.string().default('google/gemini-2.5-pro'),

    // The archive register the property is looked up in (ADR-0009). Not a
    // model: `mock` is the stand-in built into the context, which holds three
    // records and needs no process, and `http` is whoever serves the register
    // contract — today `apps/registry-stub`, one day a real state register, and
    // the difference between them is this line.
    REGISTRY_PROVIDER: z.enum(['mock', 'http']).default('mock'),
    REGISTRY_URL: z.string().nonempty().default('http://localhost:3100'),
    // A register that does not answer must not hold up a verification: the
    // stage is abandoned and the report says the property was not confirmed.
    REGISTRY_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),

    /*
     * The National Archive Fund, asked by the QR code decoded off a paper
     * (ADR-0028, ADR-0034).
     *
     * `mock` is the default and the stand-in built into the context: it holds
     * the one paper the repository has a case for and needs no network. `http`
     * asks the archive's own electronic document service — the one the codes on
     * its certified copies resolve to — which answers who signed the electronic
     * original and whether the signature verifies. Pointing it at the real
     * service sends a case id off this machine, which is why it is not the
     * default.
     */
    NATIONAL_ARCHIVE_PROVIDER: z.enum(['mock', 'http']).default('mock'),
    NATIONAL_ARCHIVE_URL: z
      .string()
      .nonempty()
      .default('https://api.esd.milliarxiv.gov.az/signature-info/api'),
    // An archive that does not answer must not hold up a verification: the
    // paper is left unchecked and the report says it was not confirmed.
    NATIONAL_ARCHIVE_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(5000),
    /*
     * The same archive, but the download of its signed copy rather than the
     * question about it (COMM-153).
     *
     * Separate because the two are not the same call. The metadata question
     * answers in well under a second; the copy is a presigned S3 download of
     * whatever the archive scanned, and it shares nothing with the API but the
     * domain name. Under one budget a five-second ceiling that is generous for
     * the question is tight for a multi-megabyte scan, and the scan losing the
     * race reaches the inspector as an archive that states nothing.
     */
    NATIONAL_ARCHIVE_COPY_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(30_000),
  })
  .transform(env => ({
    service: {
      host: env.SERVICE_HOST,
      port: env.SERVICE_PORT,
    },
    web: {
      origin: env.WEB_ORIGIN,
    },
    /*
     * The edge's own slice: a session is how a browser carries the answer to a
     * sign-in from one request to the next, which is transport and not a
     * context's business (ADR-0029).
     */
    session: {
      // Generated when none was configured, so a developer's stack works out of
      // the box. What it costs is said at start-up and in .env.example: the key
      // is this process's alone, so a restart signs everybody out.
      secret: env.SESSION_SECRET ?? randomBytes(32).toString('base64url'),
      ttlSeconds: env.SESSION_TTL,
      secure: env.SESSION_COOKIE_SECURE,
    } satisfies SessionOptions,
    // Whether the secret was configured or invented, for the line that says we
    // started. Not the secret itself, and never the secret itself.
    sessionSecretConfigured: env.SESSION_SECRET !== undefined,
    // The slice handed to `AccountsModule.forRootAsync`.
    accounts: {
      database: {
        url: env.ACCOUNTS_DATABASE_URL,
      },
      seed: {
        operatorPassword: env.SEED_OPERATOR_PASSWORD,
        userPassword: env.SEED_USER_PASSWORD,
      },
    } satisfies AccountsModuleOptions,
    /*
     * The register as the edge reaches it, for the operator's own archive
     * search. The same address the verification context is given, because there
     * is one register — but no `provider`: `mock` is that context's way of
     * running a submission's pipeline offline, and an operator searching the
     * archive is asking the archive, not a stand-in for it (ADR-0009).
     */
    registry: {
      url: env.REGISTRY_URL,
      timeoutMs: env.REGISTRY_TIMEOUT_MS,
    } satisfies RegistryClientOptions,
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
      geometry: {
        provider: env.GEOMETRY_PROVIDER,
        model: env.GEOMETRY_MODEL,
      },
      registry: {
        provider: env.REGISTRY_PROVIDER,
        url: env.REGISTRY_URL,
        timeoutMs: env.REGISTRY_TIMEOUT_MS,
      },
      nationalArchive: {
        provider: env.NATIONAL_ARCHIVE_PROVIDER,
        url: env.NATIONAL_ARCHIVE_URL,
        timeoutMs: env.NATIONAL_ARCHIVE_TIMEOUT_MS,
        copyTimeoutMs: env.NATIONAL_ARCHIVE_COPY_TIMEOUT_MS,
      },
    } satisfies VerificationModuleOptions,
  }));

export type Environment = z.infer<typeof EnvironmentSchema>;
