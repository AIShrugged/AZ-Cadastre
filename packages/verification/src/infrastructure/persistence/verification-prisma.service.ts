import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";

import {
  VERIFICATION_OPTIONS,
  type VerificationModuleOptions,
} from "../../verification.module-defs.js";
import { PrismaClient } from "./generated/client.js";

@Injectable()
export class VerificationPrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(VerificationPrismaService.name);

  constructor(@Inject(VERIFICATION_OPTIONS) options: VerificationModuleOptions) {
    // From the options the composition root handed in rather than
    // the config module ahead of this one.
    const { url } = options.database;

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
