import { DocumentTypeSpec } from './verification-profile.vo.js';

/*
 * The archive's own signed copy, as a kind of paper a reader can be asked
 * about (ADR-0038, narrowing ADR-0035).
 *
 * Its own type and not `disposal_order`, although the order is what it
 * reproduces: this is one sheet of the National Archive Fund's making — a
 * covering letter to the applicant with the order copied out under it — and a
 * reader told it is holding a disposal order looks for the order's own
 * letterhead and finds the archive's. No profile asks for it and no package
 * carries it; it exists only to be read off the file the QR code leads to.
 */
export const ARCHIVE_SIGNED_COPY_TYPE = 'archive_signed_copy';

/*
 * What the eight lines of the comparison are read off the archive's copy by
 * (ADR-0028, ADR-0038).
 *
 * Read by a reader and not by labels. The sheet was written as a letter and the
 * order under it as prose, and the labels a panel would carry — "ünvanı",
 * "sahəsi" — appear on it only inside ordinary words: `ünvanında qeydiyyatda
 * olan`, `torpaq sahəsinin ayrılmasını xahiş etmişdir`. A reader keyed to those
 * words answered with the tail of the sentence they sat in and the comparison
 * called a valid paper a forgery (COMM-145). There is nothing to key to, so the
 * sheet goes through the reader every sheet of a package goes through, with the
 * schema below saying what to look for.
 *
 * The notes carry the one distinction the sheet turns on: every value belongs
 * to the order the archive copied out, never to the archive's own covering
 * letter, which prints a date and a reference number of its own directly above
 * it.
 */
export const ARCHIVE_SIGNED_COPY_SPEC: DocumentTypeSpec = DocumentTypeSpec.of({
  key: ARCHIVE_SIGNED_COPY_TYPE,
  description:
    "The National Archive Fund's own certified copy of an archived document " +
    'about a land plot — usually a covering letter from an archive branch to ' +
    'the applicant, with the archived document (an order, a decision or an ' +
    'act of an executive authority) copied out under it, often headed "Arxiv ' +
    'çıxarışı". Everything asked for below is a value OF THE ARCHIVED ' +
    "DOCUMENT, never of the covering letter: the letter's own date, outgoing " +
    'number, addressee and signatory are not answers to any key here.',
  hints: [
    'arxiv çıxarışı',
    'təsdiq edilmiş arxiv çıxarışı',
    'архивная выписка',
  ],
  required: false,
  alwaysAccepted: false,
  // Whatever the copied-out document carries. Nothing here is judged on the
  // marks: this sheet is never counted as a document of a package.
  expectsStamp: false,
  expectsSignature: false,
  source: 'NationalArchive',
  fields: [
    [
      'document_no',
      'Number of the archived document',
      'the number the copied-out document itself carries — the number after ' +
        '"SƏRƏNCAM №", "QƏRAR №" or the like. Not the outgoing reference of ' +
        "the archive's covering letter.",
    ],
    [
      'issue_date',
      'Date of the archived document',
      'the date the copied-out document was issued, which on an order of the ' +
        'nineteen-nineties is printed as «21» _04_ 1999-cu il. Not the date ' +
        'the archive wrote its letter.',
    ],
    [
      'issuing_authority',
      'Authority that issued the archived document',
      'the body whose act was copied out, as its own heading names it — not ' +
        'the archive branch that certified the copy.',
    ],
    [
      'holder_name',
      'Surname, name and patronymic of the person the plot was allotted to',
      'the person the copied-out document grants the right to. The order ' +
        'names them in an oblique case and surname-last ("vət. Yavər Kərim ' +
        'oğlu Hümbətova"); return the base form. Where the letter is ' +
        'addressed to a representative, the holder is still the person the ' +
        'order allots to.',
    ],
    [
      'property_address',
      'Address of the plot allotted',
      'the whereabouts of the parcel as the copied-out document states them, ' +
        'street and number and any landmark it gives. Not the address the ' +
        'applicant is registered at, which the covering letter prints.',
    ],
    [
      'plot_area',
      'Size of the plot allotted',
      'as printed and with its unit — "0,06 ha". Give the figure alone with ' +
        'its unit, without the sentence around it.',
    ],
    [
      'decree_item',
      'Item number under Decree 439 (classification)',
      'the point of the Decree No. 439 list the copied-out document states ' +
        'it is issued under, where it states one. Most such documents state ' +
        'none — answer null then. Do not classify the document yourself, and ' +
        "never answer with a numbered point of the order's own operative " +
        'part or with a clause of some other law it cites.',
    ],
    [
      'archive_reference',
      'Archive fond, inventory, file and sheet',
      'the reference into the holdings the copy cites, usually on its last ' +
        'line after "ƏSAS:" — "Fond-128, siy.1, iş-1043, vər.-69, 70, 72". ' +
        'Give it whole, as printed.',
    ],
  ],
});
