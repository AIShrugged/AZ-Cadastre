import { z } from "zod";

export const EnvironmentSchema = z.object({
  SERVICE_PORT: z.coerce.number().int().positive().default(3000),
  SERVICE_HOST: z.string().nonempty().default("0.0.0.0"),

  WEB_ORIGIN: z.string().nonempty().default("http://localhost:5173"),
});

export type Environment = z.infer<typeof EnvironmentSchema>;
