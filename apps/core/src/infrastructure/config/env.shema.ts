import { z } from "zod";

export const EnvironmentSchema = z
  .object({
    // listen
    SERVICE_PORT: z.coerce.number().int().positive().default(3000),
    SERVICE_HOST: z.string().default("0.0.0.0"),

    // database
    DB_HOST: z.string().nonempty().default("localhost"),
    DB_PORT: z.coerce.number().int().positive().default(5432),
    DB_USERNAME: z.string().nonempty().default("postgres"),
    DB_PASSWORD: z.string().nonempty().default("postgres"),
    DB_NAME: z.string().nonempty().default("cadastre-db"),

    // web origin allowed to call this API / receive presigned uploads (CORS)
    WEB_ORIGIN: z.string().nonempty().default("http://localhost:5173"),

    // object storage (Garage / S3). The endpoint must be reachable from BOTH
    // this service and the browser, because the presigned URL we hand back
    // points at it directly.
    S3_ENDPOINT: z.string().nonempty().default("http://localhost:3900"),
    S3_REGION: z.string().nonempty().default("garage"),
    S3_BUCKET: z.string().nonempty().default("documents"),
    S3_ACCESS_KEY: z.string().nonempty(),
    S3_SECRET_KEY: z.string().nonempty(),
    // Garage speaks path-style (vhost-style is opt-in); keep true.
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
      host: env.DB_HOST,
      port: env.DB_PORT,
      username: env.DB_USERNAME,
      password: env.DB_PASSWORD,
      name: env.DB_NAME,
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
