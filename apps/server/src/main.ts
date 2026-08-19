import { NestFactory } from "@nestjs/core";
import { StandardSchemaValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { ServerModule } from "./server.module.js";
import type { Environment } from "./config/index.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(ServerModule);
  const config = app.get<ConfigService<Environment, true>>(ConfigService);

  app.useGlobalPipes(new StandardSchemaValidationPipe());
  app.enableCors({ origin: config.get("web", { infer: true }).origin });

  app.setGlobalPrefix("api");

  const service = config.get("service", { infer: true });
  await app.listen(service.port, service.host);
}

void bootstrap();

