import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Локальный прототип без логина: открываем CORS для dev-фронтенда.
  app.enableCors({ origin: true });
  app.setGlobalPrefix("api");
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`core: http://localhost:${port}/api`);
}

bootstrap();
