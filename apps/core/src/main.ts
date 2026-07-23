import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";

import { AppModule } from "./app.module.js";
import type { Environment } from "./infrastructure/config/env.shema.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = app.get(ConfigService<Environment, true>);
  const service = config.get("service", { infer: true });
  const web = config.get("web", { infer: true });

  app.setGlobalPrefix("api");
  app.enableCors({ origin: web.origin });

  await app.listen(service.port, service.host);
}

bootstrap();
