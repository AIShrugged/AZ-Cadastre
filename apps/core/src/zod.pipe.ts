import { BadRequestException, type PipeTransform } from "@nestjs/common";
import type { ZodType } from "zod";

/**
 * Validates a request payload against a zod schema from @cadastre/contracts.
 * Usage: `@Body(new ZodBody(FlagDecisionRequest)) body: FlagDecisionRequest`.
 */
export class ZodBody<T> implements PipeTransform {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException({
        message: "Sorğu gövdəsi sxemə uyğun deyil.",
        issues: parsed.error.issues,
      });
    }
    return parsed.data;
  }
}
