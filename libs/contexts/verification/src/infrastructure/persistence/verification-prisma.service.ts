import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaPg } from "@prisma/adapter-pg";

import type { Environment } from "../config/index.js";
import { PrismaClient } from "./generated/client.js";

@Injectable()
export class VerificationPrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(VerificationPrismaService.name);

  constructor(config: ConfigService<Environment, true>) {
    // Through ConfigService rather than `process.env`: it is also what orders
    // the config module ahead of this one.
    const { url } = config.get("database", { infer: true });

    super({ adapter: new PrismaPg({ connectionString: url }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log("Connected to PostgreSQL");
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
