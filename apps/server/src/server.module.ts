import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';

import { ApiGatewayModule } from '@cadastre/api-gateway';
import { LoggerModule } from '@cadastre/logger';
import { VerificationModule } from '@cadastre/verification';

import { EnvironmentSchema, type Environment } from './config/index.js';
import { LOCAL_PROVIDERS } from './infrastructure/index.js';

/**
 * The only place in the system that knows every context exists. It mounts them,
 * hands each one its typed slice of the environment, and binds the ports. There
 * is no business rule in this file and there is not meant to be one.
 */
const verification = VerificationModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService<Environment, true>) =>
    config.get('verification', { infer: true }),
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: config => EnvironmentSchema.parse(config),
      envFilePath: ['.env.local', '.env'],
    }),
    CqrsModule.forRoot(),
    /*
     * Registered here and nowhere else: the module is global, so the context,
     * the edge and Nest itself write through one instance and one destination
     * (ADR-0008). It comes before everything that logs — a module whose
     * constructor has something to say is constructed after this one.
     */
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>) =>
        config.get('logger', { infer: true }),
    }),

    verification,

    ApiGatewayModule.forRoot({
      imports: [verification],
      providers: LOCAL_PROVIDERS,
    }),
  ],
})
export class ServerModule {}
