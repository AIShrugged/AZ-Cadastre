import { NestFactory } from "@nestjs/core";
import { StandardSchemaValidationPipe } from "@nestjs/common";

import { AppModule } from "./app.module.js";
import { EnvironmentSchema } from "./config/index.js";

async function bootstrap(): Promise<void> {
  const environment = EnvironmentSchema.parse(process.env);

  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new StandardSchemaValidationPipe());
  app.enableCors({ origin: environment.WEB_ORIGIN });

  app.setGlobalPrefix("api");

  await app.listen(environment.SERVICE_PORT, environment.SERVICE_HOST);
}

void bootstrap();
