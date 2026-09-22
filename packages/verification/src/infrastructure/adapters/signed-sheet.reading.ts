import {
  ARCHIVE_QR_FIELDS,
  type ArchiveQrField,
} from '../../domain/value-objects/index.js';

/**
 * What the archive's own signed PDF states, read off the digitised sheet
 * (ADR-0035).
 *
 * Every line is null where the sheet does not print it. `valid` is null and not
 * `false` where the signature panel says nothing either way: a sheet that makes
 * no claim about its signature has not denied it, and reporting a denial would
 * turn an unread panel into a finding against the package.
 */
export type SignedSheetReading = {
  readonly lines: Readonly<Record<ArchiveQrField, string | null>>;
  readonly signature: {
    readonly signedBy: string | null;
    readonly organisation: string | null;
    readonly unit: string | null;
    readonly signedOn: string | null;
    readonly certificateValidity: string | null;
    readonly valid: boolean | null;
  };
};

/*
 * The words the archive's sheets label each line with, in the two languages
 * they are printed in and with the spellings a reader of a scan produces.
 *
 * Labels and not positions: the archive's electronic document service renders
 * the same panel at a different place on every paper it attests, and a reader
 * keyed to the third line of the second table would answer confidently with the
 * wrong value the first time the template moved.
 *
 * Longest first, because a label is matched by containment: "sertifikatı verən
 * təşkilat" has to be tried before "təşkilat", or the unit and the issuer both
 * answer with the organisation.
 */
const LABELS: Readonly<Record<ArchiveQrField, readonly string[]>> = {
  document_no: [
    'sərəncamın nömrəsi',
    'sənədin nömrəsi',
    'sərəncam nömrəsi',
    'номер распоряжения',
    'номер документа',
    '№ документа',
  ],
  issue_date: [
    'sərəncamın tarixi',
    'sənədin tarixi',
    'verilmə tarixi',
    'дата распоряжения',
    'дата документа',
    'дата выдачи',
  ],
  issuing_authority: [
    'sənədi verən orqan',
    'sərəncamı verən orqan',
    'verən orqan',
    'орган, выдавший документ',
    'выдавший орган',
  ],
  holder_name: [
    'soyadı, adı, atasının adı',
    'adı, soyadı',
    'soyadı, adı',
    'ərizəçi',
    'sahibi',
    'фамилия, имя, отчество',
    'заявитель',
    'владелец',
    'ф.и.о',
  ],
  property_address: [
    'torpaq sahəsinin ünvanı',
    'obyektin ünvanı',
    'ünvanı',
    'ünvan',
    'адрес объекта',
    'местоположение',
    'адрес',
  ],
  plot_area: [
    'torpaq sahəsinin sahəsi',
    'torpaq sahəsi',
    'sahəsi',
    'площадь земельного участка',
    'площадь участка',
    'площадь',
  ],
  decree_item: ['sərəncamın bəndi', 'bəndi', 'bənd', 'пункт'],
  archive_reference: [
    'arxiv arayışı',
    'arxiv şifri',
    'fond',
    'архивный шифр',
    'фонд',
  ],
};

const SIGNATURE_LABELS = {
  signedBy: [
    'sənədi imzalayan şəxs',
    'sənədi imzalayan',
    'imzalayan',
    'кем подписан',
    'подписант',
    'подписал',
  ],
  organisation: [
    'sertifikatı verən təşkilat',
    'sertifikat verən təşkilat',
    'организация, выдавшая сертификат',
    'выдавшая сертификат организация',
  ],
  unit: [
    'struktur bölməsi',
    'struktur bölmə',
    'структурное подразделение',
    'подразделение',
  ],
  signedOn: [
    'imzalanma tarixi',
    'imza tarixi',
    'дата подписания',
    'дата подписи',
  ],
  certificateValidity: [
    'sertifikatın etibarlılıq müddəti',
    'sertifikatın etibarlılıq tarixi',
    'etibarlılıq müddəti',
    'срок действия сертификата',
    'срок действия',
  ],
} as const satisfies Record<string, readonly string[]>;

/*
 * The no-name line of the panel: whether the signature verified.
 *
 * Denials are looked for first and on purpose. "İmza təsdiqlənmədi" contains
 * "imza təsdiqlən", so a reader that asked about confirmation first would read
 * every refusal as a confirmation — the one mistake this line must not make.
 */
const SIGNATURE_DENIED = [
  'imza təsdiqlənmədi',
  'imza təsdiqlənməyib',
  'imza etibarsızdır',
  'etibarsız imza',
  'подпись не подтверждена',
  'подпись недействительна',
  'signature is not valid',
  'signature is invalid',
];

const SIGNATURE_CONFIRMED = [
  'imza təsdiqləndi',
  'imza təsdiqlənib',
  'imza etibarlıdır',
  'etibarlı imza',
  'подпись подтверждена',
  'подпись действительна',
  'signature is valid',
];

// A value longer than this is the reader having run two columns together, and
// a page of prose in a table cell tells an inspector nothing.
const LONGEST_VALUE = 300;

/**
 * Read one digitised sheet of the archive's signed PDF.
 *
 * Nothing here judges: a value the sheet does not print comes back null, and
 * what agrees with the paper in hand is settled in the domain, where the rules
 * for comparing a reading live (ADR-0028).
 */
export function readSignedSheet(text: string): SignedSheetReading {
  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  const folded = lines.map(fold);
  const read = (labels: readonly string[]): string | null =>
    valueUnder(lines, folded, labels);

  return {
    lines: Object.fromEntries(
      ARCHIVE_QR_FIELDS.map(field => [field, read(LABELS[field])]),
    ) as Record<ArchiveQrField, string | null>,
    signature: {
      signedBy: read(SIGNATURE_LABELS.signedBy),
      organisation: read(SIGNATURE_LABELS.organisation),
      unit: read(SIGNATURE_LABELS.unit),
      signedOn: read(SIGNATURE_LABELS.signedOn),
      certificateValidity: read(SIGNATURE_LABELS.certificateValidity),
      valid: verdictOn(folded),
    },
  };
}

function verdictOn(folded: readonly string[]): boolean | null {
  const says = (phrases: readonly string[]): boolean =>
    folded.some(line => phrases.some(phrase => line.includes(fold(phrase))));

  if (says(SIGNATURE_DENIED)) return false;

  return says(SIGNATURE_CONFIRMED) ? true : null;
}

/*
 * The value a label introduces: what follows it on the same line, or — where
 * the label is a heading with nothing after it — the line below.
 *
 * Both shapes occur on the same sheet. A signature panel renders as a
 * two-column table, which digitises as "label: value" on one line from a text
 * layer and as two lines from an OCR pass over the same table.
 */
function valueUnder(
  lines: readonly string[],
  folded: readonly string[],
  labels: readonly string[],
): string | null {
  for (const label of labels) {
    const wanted = fold(label);
    const at = folded.findIndex(line => line.includes(wanted));

    if (at === -1) continue;

    const line = lines[at] ?? '';
    const after = cleaned(line.slice(indexOfFolded(line, wanted)));

    if (after) return after;

    const below = cleaned(lines[at + 1] ?? '');

    // A heading followed by another heading states nothing: the value is on
    // neither line, and answering with the next label would be a reading
    // nobody printed.
    if (below && !isALabel(fold(below))) return below;
  }

  return null;
}

function isALabel(folded: string): boolean {
  return [...Object.values(LABELS), ...Object.values(SIGNATURE_LABELS)].some(
    labels => labels.some(label => folded.includes(fold(label))),
  );
}

/*
 * Where the label ends in the original line.
 *
 * Folding never changes a string's length — it lowercases and swaps single
 * letters — so a position found in the folded line is the same position in the
 * line itself, which is what lets the value keep its own spelling.
 */
function indexOfFolded(line: string, wanted: string): number {
  const at = fold(line).indexOf(wanted);

  return at === -1 ? 0 : at + wanted.length;
}

function cleaned(raw: string): string | null {
  const value = raw.replace(/^[\s:：\-–—|]+/u, '').trim();

  if (value.length === 0) return null;

  return value.length > LONGEST_VALUE ? value.slice(0, LONGEST_VALUE) : value;
}

/*
 * One spelling of a letter, so a label matches whichever the reader produced.
 *
 * A scan read by OCR comes back with the Azerbaijani diacritics half-applied —
 * "təşkilat" as "teskilat", "İmza" as "Imza" — and a label table written in the
 * printed spelling would then match nothing. Length is preserved letter for
 * letter on purpose: `indexOfFolded` depends on it.
 */
const LETTERS: ReadonlyMap<string, string> = new Map(
  Object.entries({
    ə: 'e',
    Ə: 'E',
    ı: 'i',
    // Lowercased by the runtime into "i" plus a combining dot, which is two
    // code units where the label table has one — and every index after it would
    // then be off by one. Folded to plain "I" before the case is dropped.
    İ: 'I',
    ş: 's',
    Ş: 'S',
    ç: 'c',
    Ç: 'C',
    ğ: 'g',
    Ğ: 'G',
    ö: 'o',
    Ö: 'O',
    ü: 'u',
    Ü: 'U',
    ё: 'е',
    Ё: 'Е',
  }),
);

function fold(raw: string): string {
  return [...raw]
    .map(letter => LETTERS.get(letter) ?? letter)
    .join('')
    .toLowerCase();
}
