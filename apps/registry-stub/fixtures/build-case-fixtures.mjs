/**
 * Builds the two customer cases as workbooks an inspector can upload:
 * `fixtures/archive/cases/`, one file per case, both in the shape of
 * `пасбаза 2 Smtn.xlsx` — the technical passport database.
 *
 * ── Why these exist ─────────────────────────────────────────────────────────
 * The register's two customer cases are in the seed, and the seed is a
 * `db:seed` away: nothing is uploaded, and the demo skips the whole import.
 * These carry the same two cases in an archive register's own shape instead, so
 * the inspector puts them in the way the archive actually hands them over — a
 * workbook — and the register knows the property because a file was imported
 * and not because a script wrote it.
 *
 * They are therefore an ALTERNATIVE TO `db:seed` AND NOT AN ADDITION TO IT.
 * Loading both leaves two records at each of these addresses and every lookup
 * answers `Ambiguous`, which is the one thing a fixture must never cause. The
 * demo is:
 *
 *   pnpm --filter @cadastre/registry-stub exec prisma migrate reset --force --skip-seed
 *   curl -F file=@fixtures/archive/cases/rubabe-buzovna.xlsx      localhost:3100/api/import/records
 *   curl -F file=@fixtures/archive/cases/vladimirovna-zabrat.xlsx localhost:3100/api/import/records
 *
 * `--skip-seed` is not optional: `db:reset` runs the seed from
 * `prisma.config.ts`, and a reset without the flag puts back exactly what these
 * files are here to replace.
 *
 * ── Why the technical passport database ─────────────────────────────────────
 * It is the only one of the six that carries an address AND the areas together.
 * `Mulkuyat` has no area column, the Land Committee registers have no address
 * column at all, and the two inventory-office books are non-residential only.
 * Both of these cases are individual houses whose areas are the point — the
 * register holds 0.0309 ha for Buzovna and the plan-scheme surveys 0.0468 ha,
 * and a shape that cannot state an area cannot state that they differ.
 *
 * `Лист5` of the six sheets, because it is the one that also heads a storey and
 * a build-year column.
 *
 * The register is written in the Azerbaijani legacy Cyrillic code page — `ə` as
 * `я`, `ü` as `ц`, `ğ` as `ь`, `ö` as `ю`, `g` as `э`, `c` as `ъ`, `h` as `щ`.
 * The submissions are in Latin. That the two resolve to each other is not
 * assumed here: every record below is held against the Latin its own
 * application carries, by the same rules the register answers with, and this
 * script fails rather than write a file whose address nobody can look up.
 *
 * Run with `pnpm --filter @cadastre/registry-stub fixtures:cases`.
 */
import fs from 'node:fs';
import path from 'node:path';

import { addressesAgree, areasAgree, namesAgree } from '@cadastre/matching-engine';

import { buildRegisterFixture } from './lib/register-fixture.mjs';

const SOURCE = 'пасбаза 2  Smtn.xlsx';
const SHEET = 'Лист5';
const OUT = path.join(import.meta.dirname, 'archive', 'cases');

/*
 * ── The case that confirms ──────────────────────────────────────────────────
 * Rusadze Vera Vladimirovna, an individual house on a plot in Zabrat allotted
 * by decree 1471 of 29.10.1998 and corrected by decree 396 of 02.12.2021. Off
 * `INPUTS/Example application and other document- Vera Vladimirovna.pdf`.
 *
 * The figures agree, and that is the case: the decree allotted 400.0 kv.m, the
 * register holds 0.04 ha, and 400 square metres is 0.04 hectares however the
 * paper writes it. It is the record an inspector should be able to close.
 */
const ZABRAT = {
  latin: {
    // As the submission's own plan-scheme and circulation sheet spell it.
    address:
      'Bakı şəhəri, Sabunçu rayonu, Zabrat qəsəbəsi, ' +
      'Qazı Məhəmmədov küçəsi, giriş 95A',
    owner: 'Rusadze Vera Vladimirovna',
    // What the register holds, in the unit the extract states it in.
    plotArea: '0.04 ha',
  },
  row: {
    'Сыра №': '1',
    Ил: '2026',
    // Half the key: the passport database numbers its passports from 1 within
    // each region, so the region is not decoration (ADR-0010, ADR-0012 §5).
    Реэион: 'Сабунчу',
    'Обйектин ады': 'Фярди йашайыш еви',
    Цнван:
      'Бакы шящяри, Сабунчу району, Забрат гясябяси, ' +
      'Газы Мящяммядов кцчяси, эириш 95А',
    'Баланс сах./Мцлкиййятчи': 'Русадзе Вера Владимировна',
    'Цмуми сащя': '162.9',
    // 400 kv.m, which is the 0.04 ha of the extract and the 400.0 kv.m of the
    // 1998 decree's location scheme. The register states areas in metres.
    'Торпаг сащяси': '400',
    // Invented, and the only invented figure here: no paper in the package
    // carries a technical passport number, and the register cannot key a row
    // without one. Unique within Сабунчу, which is all the key requires.
    'Паспорт нюмряси': '5648',
    'Тяртиб едилмя тарихи': '28.01.2026',
    'Тикилиалты сащя': '112.0',
    // As the sheet's own example row writes a storey count.
    Мяртябяси: '1 (бир)',
  },
};

/*
 * ── The case that does not add up ───────────────────────────────────────────
 * Əliyeva Rübabə Kavı qızı, an individual house in Buzovna on a household plot
 * allotted out of the sovkhoz by Absheron decree 096 of 15.04.1999. Off
 * `INPUTS/Example application and other documents- Əliyeva Rübabə.pdf` and the
 * circulation records beside it.
 *
 * The register holds 0.0309 ha. The submission's own papers do not agree with
 * each other either — the 1999 decree allotted 0.05 ha and the plan-scheme
 * surveys 0.0468 ha — and it is the plan-scheme's figure the profile holds
 * against the record. 0.0468 ha is not 0.0309 ha, and the whole point of
 * putting this case in a register with an area column is that the register can
 * say so.
 */
const BUZOVNA = {
  latin: {
    address:
      'Bakı şəhəri, Xəzər rayonu, Buzovna qəsəbəsi, 5-862 saylı torpaq sahəsi',
    owner: 'Əliyeva Rübabə Kavı qızı',
    plotArea: '0.0309 ha',
    // What the plan-scheme surveys, which is what the profile asks the register
    // about. It must NOT agree — see the check below.
    surveyed: '0.0468 ha',
  },
  row: {
    'Сыра №': '1',
    Ил: '2026',
    Реэион: 'Хязяр',
    'Обйектин ады': 'Фярди йашайыш еви',
    Цнван:
      'Бакы шящяри, Хязяр району, Бузовна гясябяси, 5-862 сайлы торпаг сащяси',
    'Баланс сах./Мцлкиййятчи': 'Ялийева Рцбабя Кавы гызы',
    'Цмуми сащя': '233.20',
    // 0.0309 ha in the metres the register states areas in.
    'Торпаг сащяси': '309',
    // Invented, for the same reason and on the same terms as the other case.
    'Паспорт нюмряси': '3370',
    'Тяртиб едилмя тарихи': '09.01.2026',
    'Тикилиалты сащя': '175.2',
    Мяртябяси: '2 (ики)',
  },
};

const CASES = [
  ['vladimirovna-zabrat.xlsx', ZABRAT],
  ['rubabe-buzovna.xlsx', BUZOVNA],
];

/**
 * Holds a record against the Latin its own application carries, by the rules
 * the register answers with.
 *
 * A fixture whose address does not resolve is worse than no fixture: the import
 * succeeds, the lookup says `NotFound`, and the reason is a code page nobody
 * thinks to suspect. So it is checked here, at the only moment anyone is
 * looking at both spellings at once.
 */
function check(target, { latin, row }) {
  const fail = why => {
    throw new Error(`${target}: ${why}`);
  };

  if (!addressesAgree(latin.address, row.Цнван)) {
    fail(
      `the address the application carries does not resolve to the one written ` +
        `into the register.\n  application: ${latin.address}\n  register:    ${row.Цнван}`,
    );
  }

  if (!namesAgree(latin.owner, row['Баланс сах./Мцлкиййятчи'])) {
    fail(
      `the owner the application names does not resolve to the one written ` +
        `into the register.\n  application: ${latin.owner}\n  register:    ${row['Баланс сах./Мцлкиййятчи']}`,
    );
  }

  if (!areasAgree(latin.plotArea, row['Торпаг сащяси'])) {
    fail(
      `the plot area the register is meant to hold is not what was written ` +
        `into it.\n  meant:   ${latin.plotArea}\n  written: ${row['Торпаг сащяси']}`,
    );
  }

  // The case that does not add up only demonstrates anything if it does not.
  if (latin.surveyed && areasAgree(latin.surveyed, row['Торпаг сащяси'])) {
    fail(
      `the surveyed area ${latin.surveyed} agrees with the register's ` +
        `${row['Торпаг сащяси']}, so this case no longer shows a disagreement.`,
    );
  }
}

// Two records at one address is an `Ambiguous` lookup. These two are different
// settlements and must stay that way.
if (addressesAgree(ZABRAT.row.Цнван, BUZOVNA.row.Цнван)) {
  throw new Error(
    'the two cases resolve to one another: importing both would leave two ' +
      'records at one address and every lookup would answer Ambiguous.',
  );
}

fs.mkdirSync(OUT, { recursive: true });

for (const [target, subject] of CASES) {
  check(target, subject);

  const { file, records } = await buildRegisterFixture({
    source: SOURCE,
    target,
    rowsBySheet: { [SHEET]: [subject.row] },
    out: OUT,
  });

  process.stdout.write(`${path.relative(process.cwd(), file)} — ${records} records\n`); // prettier-ignore
}
