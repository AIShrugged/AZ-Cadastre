import type { DocumentType } from './document-type.vo.js';
import {
  DocumentTypeSpec,
  type CatalogueDeclaration,
} from './verification-profile.vo.js';

/*
 * The papers that arrive in the envelope beside the ones a profile asks for.
 * They are not the profile's business and never answer a requirement — but
 * they have names, and an inspector reading "extra document" six times over is
 * told less than one reading "courier waybill" once (ADR-0012).
 *
 * In code and not in a table, for the reason profiles are: this is policy the
 * engine interprets, and an editable list would need a UI, a migration and a
 * version before it earned anything (ADR-0002).
 *
 * The list is what the customer's own envelopes have been seen to carry, named
 * in `docs/process-overview.md` §4 step 4. It is deliberately not a guess at
 * everything that could turn up: a paper the catalogue does not know is still
 * reported, as the extra document it has always been.
 */
export class DocumentCatalogue {
  static readonly KNOWN = new DocumentCatalogue([
    {
      key: 'registrar_routing_sheet',
      description:
        "The registry's own routing sheet: the table of departments a case " +
        'passes through, initialled and dated as it goes. Internal paperwork ' +
        'about the case, not a document of the case.',
      hints: ['dövriyyə vərəqi', 'обходной лист'],
    },
    {
      key: 'expert_review_sheet',
      description:
        "The registry's own examination sheet, on which an examiner records " +
        'what they checked. Often left blank.',
      hints: ['ekspertiza vərəqi', 'лист экспертизы'],
    },
    {
      key: 'designer_licence',
      description:
        'The licence of the design organisation that drew the sketch design, ' +
        'or the annex listing what the licence permits. It is the firm that ' +
        'is licensed, never the property.',
      hints: [
        'lisenziya',
        'lisenziyaya əlavə',
        'lisenziyanın əlavəsi',
        'лицензия',
      ],
    },
    {
      key: 'valuation_contract',
      description:
        'A contract for valuation of the property, drawn up between the owner ' +
        'and a valuer. It says what the valuation will cost, not what the ' +
        'property is worth.',
      hints: [
        'qiymətləndirmə müqaviləsi',
        'договор оценки',
        'договор об оценке',
      ],
    },
    {
      key: 'courier_waybill',
      description:
        'The waybill or delivery note of the courier service the package was ' +
        'sent with. It is about the envelope, not about anything in it.',
      hints: ['kuryer xidmətinin bildirişi', 'курьерская накладная'],
    },
    {
      key: 'covering_letter',
      description:
        'A covering letter enclosing the submission, listing what is attached ' +
        'and asking that it be considered.',
      hints: ['müşayiət məktubu', 'сопроводительное письмо'],
    },
  ]);

  readonly #entries: readonly DocumentTypeSpec[];

  private constructor(declarations: readonly CatalogueDeclaration[]) {
    this.#entries = declarations.map(declaration =>
      DocumentTypeSpec.catalogued(declaration),
    );
  }

  // Described the way a profile's own types are, because whoever classifies is
  // choosing between the two lists at once and cannot be shown them in two
  // different shapes.
  get entries(): readonly DocumentTypeSpec[] {
    return this.#entries;
  }

  get types(): readonly DocumentType[] {
    return this.#entries.map(entry => entry.type);
  }

  recognises(type: DocumentType): boolean {
    return this.#entries.some(entry => entry.type.equals(type));
  }

  entryFor(type: DocumentType): DocumentTypeSpec | null {
    return this.#entries.find(entry => entry.type.equals(type)) ?? null;
  }
}
