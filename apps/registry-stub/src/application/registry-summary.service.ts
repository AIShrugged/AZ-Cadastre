import { Inject, Injectable } from '@nestjs/common';

import type {
  RegistrySourceSummaryDto,
  RegistrySummaryApi,
  RegistrySummaryResponse,
} from '@cadastre/api-contracts/registry';

import { ARCHIVE_REGISTERS, registerOfSource } from '../domain/index.js';

import { RegistrySource, type SourceHolding } from './ports/index.js';

/**
 * Says how much of the archive the register is holding, and stops there.
 *
 * There is no readiness in here, for the same reason a lookup carries no
 * verdict: whether four sources out of six is an archive worth searching is a
 * rule of whoever is asking, and the register would have to know what the
 * search is for to have an opinion (ADR-0009). It reports what is in the
 * database — never the size of the catalogue, which is how many registers the
 * archive keeps rather than how many arrived.
 *
 * Nothing is logged. The count of a tally is not an event, and the edge already
 * writes a line per request (ADR-0008); a sidebar polling this would otherwise
 * fill the log with the fact that it is still on screen.
 */
@Injectable()
export class RegistrySummaryService implements RegistrySummaryApi {
  constructor(
    @Inject(RegistrySource) private readonly source: RegistrySource,
  ) {}

  async get(): Promise<RegistrySummaryResponse> {
    const bySource = tally(await this.source.holdings());

    return {
      // Sources that actually hold something. A catalogued source nothing was
      // ever loaded from is a line below and not one of these: it is the
      // difference between "five of six are in" and "six are in", which is the
      // only thing this number is read for.
      sources: bySource.filter(source => source.records > 0).length,
      records: bySource.reduce((total, source) => total + source.records, 0),
      loadedAt: bySource.reduce<string | null>(
        (latest, source) => later(latest, source.loadedAt),
        null,
      ),
      bySource,
    };
  }
}

/**
 * One line per source, counted by register rather than by sheet.
 *
 * The catalogue's six come first and always, whether or not anything was loaded
 * from them: a line that disappears when it reaches zero cannot be read as "not
 * loaded", it reads as nothing at all, and which of the six is missing is
 * exactly what somebody looking at this wants to know.
 *
 * Anything else the register holds rows under is a line too — the seeded cases
 * carry the archive's own name for the file they came off, and the import
 * template carries whatever the operator wrote. Dropping those would leave a
 * breakdown that does not add up to the total it is printed beside.
 */
function tally(holdings: readonly SourceHolding[]): RegistrySourceSummaryDto[] {
  const lines = new Map<string, { records: number; loadedAt: string | null }>(
    ARCHIVE_REGISTERS.map(register => [
      register.id,
      { records: 0, loadedAt: null },
    ]),
  );

  for (const holding of holdings) {
    const id = registerOfSource(holding.source);
    const line = lines.get(id) ?? { records: 0, loadedAt: null };

    line.records += holding.records;
    line.loadedAt = later(
      line.loadedAt,
      holding.loadedAt?.toISOString() ?? null,
    );
    lines.set(id, line);
  }

  return [...lines].map(([id, line]) => ({ id, ...line }));
}

/**
 * The later of two instants, either of which may be no instant at all.
 *
 * Compared as text, which is sound and not a shortcut: every value here is
 * `toISOString()` — UTC, zero-padded, one width — so lexical order is
 * chronological order.
 */
function later(left: string | null, right: string | null): string | null {
  if (left === null) return right;
  if (right === null) return left;

  return left >= right ? left : right;
}
