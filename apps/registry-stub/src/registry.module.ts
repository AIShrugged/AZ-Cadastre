import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';

import { LoggerModule } from '@cadastre/logger';

import {
  AddressesService,
  RegistryImportService,
} from './application/index.js';
import { EnvironmentSchema, type Environment } from './config/index.js';
import { REGISTRY_INFRASTRUCTURE } from './infrastructure/index.js';
import {
  AddressesController,
  HealthController,
  HttpExceptionFilter,
  ImportController,
} from './presentation/http/index.js';

/**
 * The whole of the stand-in. It is deliberately one module and not a bounded
 * context: it has no language of its own, it decides nothing, and the day a
 * real register answers this contract the right move is to delete this app —
 * not to migrate it (ADR-0009).
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: config => EnvironmentSchema.parse(config),
      envFilePath: ['.env.local', '.env'],
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>) =>
        config.get('logger', { infer: true }),
    }),
  ],
  controllers: [AddressesController, HealthController, ImportController],
  providers: [
    AddressesService,
    RegistryImportService,
    ...REGISTRY_INFRASTRUCTURE,
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class RegistryModule {}
