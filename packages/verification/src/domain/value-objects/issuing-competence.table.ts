import {
  DocumentType as DocumentTypeValue,
  type DocumentType,
} from './document-type.vo.js';

/*
 * The kinds of body a Decree 439 paper can have been issued by, as the National
 * Archive Fund files them: every fund in the archive is the record of one
 * creating body, and what kind of body that was is the archive's own fact about
 * its holdings (ADR-0028).
 */
export const ISSUING_AUTHORITY_KINDS = [
  // The executive committee of a city, district or village soviet, and its
  // departments — the economic department that kept the land records among
  // them.
  'SovietExecutiveCommittee',
  // A soviet of workers' or people's deputies acting itself, by a decision of
  // its session.
  'SovietOfDeputies',
  // The technical inventory bureau (BTI): passports and inventory records.
  'TechnicalInventoryBureau',
  'Notary',
  // An executive authority of the Republic (İcra Hakimiyyəti) and its
  // representative for an administrative-territorial unit, from 1991.
  'LocalExecutiveAuthority',
  'Municipality',
  // The general meeting of a kolkhoz, or its board.
  'CollectiveFarm',
  // The management of a sovkhoz or another state agricultural enterprise.
  'StateFarm',
  // The archive itself, where the paper is an extract it made of a book it
  // keeps rather than an act of the body that kept the book.
  'NationalArchive',
] as const;

export type IssuingAuthorityKind = (typeof ISSUING_AUTHORITY_KINDS)[number];

/*
 * Which kind of body could issue which Decree 439 paper.
 *
 * Read off the Decree's own list, item by item, as each profile type's
 * description quotes it — that is the whole basis, and it is our reading of the
 * Decree rather than a table any office published (TECH_DEBT §15 is the same
 * reservation about the archive's sections). A paper whose kind is missing
 * here is not held against the archive at all: an unknown competence would
 * have to be reported as either a fault or a pass, and it is neither.
 */
const COMPETENT: Readonly<Record<string, readonly IssuingAuthorityKind[]>> = {
  // Items 1.3 and 2.1: issued by a city or district soviet's executive
  // committee.
  land_right_state_act: ['SovietExecutiveCommittee'],
  // Items 1.1 and 1.2: the executive committee's economic department, or its
  // technical inventory bureau.
  soviet_land_record: ['SovietExecutiveCommittee', 'TechnicalInventoryBureau'],
  // Items 1.4 and 2.2: a decision of the soviet — taken at its session, or by
  // its executive committee between sessions, which is how most were taken.
  land_allocation_decision: ['SovietOfDeputies', 'SovietExecutiveCommittee'],
  // Item 1.6.
  notarised_land_allocation_contract: ['Notary'],
  // Item 2.3: the household book was kept by the village soviet's executive
  // committee and, after 1991, by the local executive authority's
  // representative or the municipality; the extract is as often the archive's
  // own copy of the entry.
  household_book_extract: [
    'SovietExecutiveCommittee',
    'LocalExecutiveAuthority',
    'Municipality',
    'NationalArchive',
  ],
  // Item 2.4.
  technical_passport: ['TechnicalInventoryBureau'],
  // Item 2.5.
  kolkhoz_allocation_decision: ['CollectiveFarm'],
  // Items 2.5 and 2.5-1: the farm kept the book, and the archive copies it.
  bound_land_book_extract: ['CollectiveFarm', 'StateFarm', 'NationalArchive'],
  // Item 2.5-1.
  sovkhoz_allocation_order: ['StateFarm'],
  // Item 2.7: the representative of the local executive authority.
  homestead_land_allocation_decision: ['LocalExecutiveAuthority'],
  // Item 2.8.
  apartment_demolition_decision: ['LocalExecutiveAuthority'],
};

export class IssuingCompetence {
  static get types(): readonly DocumentType[] {
    return Object.keys(COMPETENT).map(key => DocumentTypeValue.create(key));
  }

  static covers(type: DocumentType): boolean {
    return Object.hasOwn(COMPETENT, type.value);
  }

  static of(type: DocumentType): readonly IssuingAuthorityKind[] {
    return COMPETENT[type.value] ?? [];
  }

  static competent(type: DocumentType, kind: IssuingAuthorityKind): boolean {
    return IssuingCompetence.of(type).includes(kind);
  }
}
