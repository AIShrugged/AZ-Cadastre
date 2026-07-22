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
  })
  .transform((env) => ({
    service: {
      port: env.SERVICE_PORT,
      host: env.SERVICE_HOST,
    },
    database: {
      host: env.DB_HOST,
      port: env.DB_PORT,
      username: env.DB_USERNAME,
      password: env.DB_PASSWORD,
      name: env.DB_NAME,
    },
  }));
