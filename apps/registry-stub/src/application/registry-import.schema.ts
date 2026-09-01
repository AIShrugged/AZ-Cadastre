import { z } from 'zod';

/**
 * The shape a workbook of register records has to have to be loaded.
 *
 * One schema per model of `src/infrastructure/persistence/schema`, field for
 * field, because the workbook is a transport for those rows and inventing a
 * second shape for them would be a second place to change when a register turns
 * up with a column nobody had seen. What the models decided, these schemas
 * inherit: every value is text — folder, page range, storey count, area with
 * its unit — since the sources hold `01-dən 30`, `2 (ики)` and `0,05 ha` in
 * those columns and casting them loses the value (ADR-0010 §2).
 *
 * The workbook is a sheet per model, joined on the object key
 * `(territorialOffice, registerNo)` — the key the register itself is scoped by
 * (ADR-0010 §2) and the key the seed upserts on. A child row names the object it
 * hangs off; the order the rows appear in is the order they are stored in.
 *
 * A column header no model names is ignored rather than refused. The archive's
 * own registers carry columns this schema has no model for — a clerk's note, a
 * settlement's own tally — and a file refused for one of those would be a file
 * nobody could load.
 */

/** A column the source may leave blank. A blank cell and an absent column are both null. */
const OptionalText = z.preprocess(
  value => (typeof value === 'string' && value.trim() === '' ? null : value),
  z.string().trim().nullable().default(null),
);

/** A column the register cannot key, place or attribute a row without. */
const RequiredText = z.preprocess(
  value => value ?? '',
  z.string().trim().min(1, 'must not be empty'),
);

/**
 * `buildYear` is the only number in the whole schema that is arithmetic, and it
 * is the only column read as one. Four digits and nothing else: the sources
 * write "1984-cü il" and "təxminən 1980" in this column too, and a year the
 * import guessed at would be a figure no paper states.
 */
const OptionalYear = z.preprocess(
  value => (typeof value === 'string' && value.trim() === '' ? null : value),
  z
    .string()
    .trim()
    .regex(/^\d{4}$/, 'must be a four-digit year')
    .transform(Number)
    .nullable()
    .default(null),
);

// The enums of the Prisma models, restated rather than imported: `application`
// does not reach into `infrastructure`, and a value the database would reject
// has to be caught before a row is built out of it. They are checked against the
// generated enums where the rows are written.
export const AddressKindSchema = z.enum(['Current', 'Legacy', 'Register'], {
  error: 'must be one of Current, Legacy or Register',
});

export const RightHolderKindSchema = z.enum(['Individual', 'LegalEntity'], {
  error: 'must be one of Individual or LegalEntity',
});

export const DocumentHoldingSchema = z.enum(['Held', 'NotHeld', 'Unknown'], {
  error: 'must be one of Held, NotHeld or Unknown',
});

export const AliasKindSchema = z.enum(
  [
    'Registration',
    'Inventory',
    'RegisterCode',
    'StateAct',
    'Certificate',
    'TechnicalPassport',
    'Application',
  ],
  { error: 'must be one of the alias kinds the register knows' },
);

/** Which object a row belongs to. Every sheet but `Objects` carries it. */
export const ObjectKeySchema = z.object({
  registerNo: RequiredText,
  territorialOffice: RequiredText,
});
export type ObjectKey = z.infer<typeof ObjectKeySchema>;

/** `Objects` — one row per immovable-property object, mirroring `RegistryObject`. */
export const ObjectRowSchema = ObjectKeySchema.extend({
  inventoryNo: OptionalText,
  cadastralNumber: OptionalText,
  propertyType: OptionalText,
  district: OptionalText,
  plotArea: OptionalText,
  totalArea: OptionalText,
  mainArea: OptionalText,
  auxiliaryArea: OptionalText,
  footprintArea: OptionalText,
  floors: OptionalText,
  buildYear: OptionalYear,
  ownershipType: OptionalText,
  rightType: OptionalText,
  landOwnershipType: OptionalText,
  landRightType: OptionalText,
  landCategory: OptionalText,
  registryBookNo: OptionalText,
  registryBookSheet: OptionalText,
  // Required, and not defaulted: there are six of these registers, they overlap,
  // and where they disagree somebody has to be told which one said what. A row
  // without its provenance is not usable (ADR-0010 §3).
  sourceDatabase: RequiredText,
});
export type ObjectRow = z.infer<typeof ObjectRowSchema>;

/** `Addresses` — one row per spelling, mirroring `RegistryAddress`. */
export const AddressRowSchema = ObjectKeySchema.extend({
  kind: AddressKindSchema,
  value: RequiredText,
  sourceDatabase: OptionalText,
});
export type AddressRow = z.infer<typeof AddressRowSchema>;

/** `RightHolders` — mirroring `RegistryRightHolder`. */
export const RightHolderRowSchema = ObjectKeySchema.extend({
  name: RequiredText,
  kind: RightHolderKindSchema,
  share: OptionalText,
  registrationNo: OptionalText,
  registeredOn: OptionalText,
  previousOwner: OptionalText,
  taxOrDocumentNo: OptionalText,
});
export type RightHolderRow = z.infer<typeof RightHolderRowSchema>;

/** `Documents` — the presence registers as rows, mirroring `RegistryDocument`. */
export const DocumentRowSchema = ObjectKeySchema.extend({
  // The register's own word for the kind of paper, never the caller's document
  // type: those two vocabularies were written by different offices decades
  // apart (ADR-0010 §4).
  name: RequiredText,
  holding: DocumentHoldingSchema,
  taxonomyRef: OptionalText,
  number: OptionalText,
  issuedOn: OptionalText,
  issuingAuthority: OptionalText,
  folder: OptionalText,
  pages: OptionalText,
  sourceDatabase: OptionalText,
});
export type DocumentRow = z.infer<typeof DocumentRowSchema>;

/** `Aliases` — every other number the object answers to, mirroring `RegistryAlias`. */
export const AliasRowSchema = ObjectKeySchema.extend({
  kind: AliasKindSchema,
  value: RequiredText,
  issuingOffice: OptionalText,
  sourceDatabase: OptionalText,
});
export type AliasRow = z.infer<typeof AliasRowSchema>;

/** `Locations` — where the paper is, mirroring `ArchiveLocation`. At most one per object. */
export const LocationRowSchema = ObjectKeySchema.extend({
  folder: RequiredText,
  pages: RequiredText,
  bookNo: OptionalText,
  sheetNo: OptionalText,
  fundReference: OptionalText,
  sourceDatabase: OptionalText,
});
export type LocationRow = z.infer<typeof LocationRowSchema>;

/** The sheet each model is read from. The names the template workbook carries. */
export const SHEETS = {
  objects: 'Objects',
  addresses: 'Addresses',
  rightHolders: 'RightHolders',
  documents: 'Documents',
  aliases: 'Aliases',
  locations: 'Locations',
} as const;

// A child row is stored under the object it names, so the key columns it was
// joined by are not part of what is written.
type Keyless<T> = Omit<T, keyof ObjectKey>;

export type AddressImport = Keyless<AddressRow>;
export type RightHolderImport = Keyless<RightHolderRow>;
// `sourceDatabase` is no longer nullable on these three: the models require it,
// and a sheet that left the column blank meant the object's own register.
export type DocumentImport = Keyless<DocumentRow> & { sourceDatabase: string };
export type AliasImport = Keyless<AliasRow> & { sourceDatabase: string };
export type LocationImport = Keyless<LocationRow> & { sourceDatabase: string };

/** One object and everything that hangs off it, ready to be written. */
export type ObjectImport = {
  readonly object: ObjectRow;
  readonly addresses: readonly AddressImport[];
  readonly rightHolders: readonly RightHolderImport[];
  readonly documents: readonly DocumentImport[];
  readonly aliases: readonly AliasImport[];
  readonly location: LocationImport | null;
};

/**
 * One thing the workbook says that the register cannot store, and where it says
 * it.
 *
 * Sheet, row and column and never the value: whoever uploaded the file can open
 * it at the row this names, and the register has no business copying somebody's
 * property data back out of a file it refused.
 */
export const ImportProblemSchema = z.object({
  sheet: z.string(),
  /** Null when the problem is the sheet itself rather than a row of it. */
  row: z.number().int().positive().nullable(),
  /** Null when the problem is the row as a whole. */
  column: z.string().nullable(),
  message: z.string(),
});
export type ImportProblem = z.infer<typeof ImportProblemSchema>;

/**
 * What the import did, whether or not it did all of it.
 *
 * The report is the answer and not an error body. `ErrorBody` — the register's
 * one published refusal shape — carries a sentence, and what an operator loading
 * a register file needs is a table: which rows went in, which did not and why.
 * A refusal flattened into one line would say nothing they could act on, so a
 * workbook that was read and partly refused is answered with this, and only a
 * file that is not a workbook at all is answered with an error.
 */
export const RegistryImportReportSchema = z.object({
  /** True when every row of the workbook was stored. */
  accepted: z.boolean(),
  imported: z.number().int().nonnegative(),
  /** Objects the workbook named and the register did not store. */
  refused: z.number().int().nonnegative(),
  /** Child rows written, by sheet — what an operator counts against their file. */
  rows: z.object({
    addresses: z.number().int().nonnegative(),
    rightHolders: z.number().int().nonnegative(),
    documents: z.number().int().nonnegative(),
    aliases: z.number().int().nonnegative(),
    locations: z.number().int().nonnegative(),
  }),
  problems: z.array(ImportProblemSchema),
  /** The audit line, written in English. */
  note: z.string(),
});
export type RegistryImportReport = z.infer<typeof RegistryImportReportSchema>;
