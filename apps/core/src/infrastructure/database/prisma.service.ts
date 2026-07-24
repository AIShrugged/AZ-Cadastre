import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaPg } from "@prisma/adapter-pg";

import type { Environment } from "../config/env.shema.js";
import { PrismaClient } from "./generated/client.js";

/**
 * Prisma client wired into Nest's lifecycle. Prisma 7 is engine-free: the client
 * talks to PostgreSQL through the `pg` driver adapter, fed the same
 * `DATABASE_URL` that Migrate uses (see prisma.config.ts).
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService<Environment, true>) {
    const { url } = config.get("database", { infer: true });
    super({ adapter: new PrismaPg({ connectionString: url }) });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log("✓ Connected to PostgreSQL");
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
