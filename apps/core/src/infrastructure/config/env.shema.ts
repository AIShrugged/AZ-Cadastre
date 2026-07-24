import { z } from "zod";

export const EnvironmentSchema = z
  .object({
    // listen
    SERVICE_PORT: z.coerce.number().int().positive().default(3000),
    SERVICE_HOST: z.string().default("0.0.0.0"),

    // database — canonical connection string, shared with Prisma
    DATABASE_URL: z.url().default(
      "postgresql://postgres:postgres@localhost:5432/cadastre-db?schema=public",
    ),

    // web origin allowed to call this API / receive presigned uploads (CORS)
    WEB_ORIGIN: z.string().nonempty().default("http://localhost:5173"),

    // object storage (RustFS with S3 API). The endpoint must be reachable
    // from BOTH this service and the browser, because the presigned URL we
    // hand back points at it directly.
    S3_ENDPOINT: z.string().nonempty().default("http://localhost:9000"),
    S3_REGION: z.string().nonempty().default("rustfs"),
    S3_BUCKET: z.string().nonempty().default("documents"),
    S3_ACCESS_KEY: z.string().nonempty(),
    S3_SECRET_KEY: z.string().nonempty(),
    // S3 speaks path-style (vhost-style is opt-in); keep true.
    S3_FORCE_PATH_STYLE: z
      .enum(["true", "false"])
      .default("true")
      .transform((v) => v === "true"),
    // How long a presigned upload URL stays valid, in seconds.
    S3_PRESIGN_TTL: z.coerce.number().int().positive().default(600),
  })
  .transform((env) => ({
    service: {
      port: env.SERVICE_PORT,
      host: env.SERVICE_HOST,
    },
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
  }));

export type Environment = z.infer<typeof EnvironmentSchema>;
