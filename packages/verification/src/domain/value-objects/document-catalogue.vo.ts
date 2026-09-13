import type { DocumentType } from './document-type.vo.js';
import {
  DocumentTypeSpec,
  type CatalogueDeclaration,
} from './verification-profile.vo.js';

/*
 * The papers that arrive in the envelope beside the ones a profile asks for.
 * They are not the profile's business and never answer a requirement — but
 * they have names, and an inspector reading "extra document" thirty times over
 * is told less than one reading "auction results protocol" once (ADR-0012).
 *
 * In code and not in a table, for the reason profiles are: this is policy the
 * engine interprets, and an editable list would need a UI, a migration and a
 * version before it earned anything (ADR-0002).
 *
 * The list is no longer "what the envelopes have been seen to carry". It is the
 * statutory list of grounds for state registration — Article 8 of the Law "On
 * the State Register of Immovable Property" and the list approved by
 * Presidential Decree No. 439 of 13 January 2015 — plus the papers of the
 * application itself and the registry's own service sheets (ADR-0022). The
 * source is the customer's own checklist, `Fedor Zhernovoy/Example
 * application/Individual residential houses/Document-Checklists State
 * Registration AZ-EN.xlsx`, and the deck of sample scans beside it.
 *
 * Grounds the cadastre profile reads — the title documents its provisions rest
 * on and the papers a provision asks for — are the profile's own types since
 * ADR-0025 and are not listed here: a key is in one list or the other, never
 * both, or the same paper would answer a requirement and be an extra document
 * depending on which list was consulted first.
 *
 * A paper the catalogue does not know is still reported, as the extra document
 * it has always been — that is what the report calls "other documents".
 */

// Why the entry is in the catalogue at all. The classifier is shown one heading
// per group rather than fifty keys in a row: a ground under Article 8 and a
// service sheet of the registrar's are read differently, and a flat list of
// this length is read worse than a grouped one.
export type CatalogueGroup = {
  readonly key: string;
  // The heading the group is printed under in a classifier prompt.
  readonly title: string;
  readonly documents: readonly CatalogueDeclaration[];
};

// Grounds for the state registration of a right, as Article 8 of the Law lists
// them. Each of these is a title document: it is what a right is registered
// ON. None of them is what the cadastre profile asks for — that profile
// requires the papers of a first registration of a new house — so a document
// read as one of these is named and reported, and answers no requirement.
const ARTICLE_8: readonly CatalogueDeclaration[] = [
  {
    key: 'auction_results_protocol',
    description:
      'Protocol recording the results of an auction held in the manner the ' +
      'law prescribes, drawn up by the auction organiser (Article 8.0.2). It ' +
      'names the lot, the winner and the price bid.',
    hints: [
      'hərracın nəticələri haqqında protokol',
      'hərrac protokolu',
      'протокол о результатах аукциона',
      'протокол аукциона',
    ],
  },
  {
    key: 'notarised_property_contract',
    description:
      'Contract in respect of immovable property certified by a notary — ' +
      'sale, gift, exchange, division (Article 8.0.3). It moves the property ' +
      'itself between parties. A contract to value the property, or one about ' +
      'the right to build on the land, is not this.',
    hints: [
      'daşınmaz əmlak barəsində notariat qaydasında təsdiq edilmiş müqavilə',
      'alqı-satqı müqaviləsi',
      'bağışlama müqaviləsi',
      'нотариально удостоверенный договор',
      'договор купли-продажи',
      'договор дарения',
    ],
  },
  {
    key: 'inheritance_certificate',
    description:
      'Certificate of the right of inheritance, issued by a notary to an ' +
      'heir (Article 8.0.3). It says who inherited what, not what the ' +
      'property is.',
    hints: [
      'vərəsəlik hüququ haqqında şəhadətnamə',
      'vərəsəlik şəhadətnaməsi',
      'свидетельство о праве на наследство',
    ],
  },
  {
    key: 'spousal_share_certificate',
    description:
      "Notary's certificate of the ownership of a share in the common " +
      'property of spouses (Article 8.0.3). It divides an existing right ' +
      'between two people; it does not create one.',
    hints: [
      'ər-arvadın ümumi əmlakındakı paya mülkiyyət hüququ haqqında şəhadətnamə',
      'paya mülkiyyət hüququ haqqında şəhadətnamə',
      'свидетельство о праве собственности на долю в общем имуществе супругов',
    ],
  },
  {
    key: 'enforcement_sale_certificate',
    description:
      'Certificate about property issued by a notary under Article 63 of the ' +
      'Law "On Notaries", in connection with the compulsory enforcement of ' +
      'writs of execution (Article 8.0.3). The property changed hands by ' +
      'enforcement, not by agreement.',
    hints: [
      'icra sənədlərinin məcburi icrası ilə əlaqədar əmlak barədə şəhadətnamə',
      'notariat haqqında qanunun 63-cü maddəsinə əsasən verilən şəhadətnamə',
      'свидетельство об имуществе в связи с принудительным исполнением исполнительных документов',
    ],
  },
  {
    key: 'immovable_property_certificate',
    description:
      'Immovable property certificate — the transferable certificate named in ' +
      'Article 8.0.3, issued over a property rather than about a transaction ' +
      'in it.',
    hints: [
      'daşınmaz əmlak sertifikatı',
      'сертификат недвижимого имущества',
      'сертификат на недвижимое имущество',
    ],
  },
  {
    key: 'court_decision',
    description:
      'Decision of a court that has entered into legal force (Article 8.0.4), ' +
      'including the Soviet-era decisions the Decree No. 439 list names: a ' +
      'decision confirming the right to build a dwelling, and a decision of a ' +
      "comrades' court dividing a dwelling between spouses (points 1.7, " +
      '1.10). It is headed by the court and ends in an operative part.',
    hints: [
      'qanuni qüvvəyə minmiş məhkəmə qərarı',
      'məhkəmə qərarı',
      'yoldaşlıq məhkəməsinin qərarı',
      'вступившее в законную силу судебное решение',
      'решение суда',
      'решение товарищеского суда',
    ],
  },
  {
    key: 'housing_cooperative_allocation_decision',
    description:
      'Decision of the general meeting of the members of a housing-' +
      'construction cooperative allotting residential or non-residential ' +
      'space in the cooperative building, the share contribution having been ' +
      'paid in full (Article 8.0.6).',
    hints: [
      'mənzil-tikinti kooperativi üzvlərinin ümumi yığıncağının qərarı',
      'mtk üzvlərinin ümumi yığıncağının qərarı',
      'решение общего собрания членов жилищно-строительного кооператива',
    ],
  },
  {
    key: 'garden_plot_allocation_document',
    description:
      'Lease contract, order or warrant for a garden plot allotted to a ' +
      'citizen by a garden-management office up to 22 May 2007, or the ' +
      "membership book or an extract from the members' meeting minutes of a " +
      'collective gardening partnership (Article 8.0.7). The plot is a garden ' +
      'plot, not a homestead plot beside a house.',
    hints: [
      'bağ sahəsinə dair icarə müqaviləsi',
      'bağ sahəsinə dair order',
      'üzvlük kitabçası',
      'договор аренды садового участка',
      'ордер на садовый участок',
      'членская книжка',
    ],
  },
  {
    key: 'disaster_replacement_housing_list',
    description:
      'List of the persons given housing built at state expense to replace ' +
      'dwellings destroyed by a disaster or an accident (Article 8.0.10-2). ' +
      'A roll of names issued by a state body, not a document about one ' +
      'property.',
    hints: [
      'yaşayış sahələrinin əvəzinə ev verilən şəxslərin siyahısı',
      'fəlakət nəticəsində məhv olmuş yaşayış sahələri barədə siyahı',
      'список лиц, которым предоставлено жильё взамен разрушенного',
    ],
  },
  {
    key: 'state_housing_allocation_order',
    description:
      'Order, warrant or housing tenancy contract of an executive authority ' +
      'allotting dwelling space out of the state or public housing fund, up ' +
      'to 1 October 2009 (Article 8.0.11). It allots a dwelling that already ' +
      'stands; the order allotting a bare parcel to build on is a different ' +
      'paper.',
    hints: [
      'yaşayış sahəsinin verilməsinə dair order',
      'mənzil orderi',
      'mənzil kirayəsi müqaviləsi',
      'ордер на жилое помещение',
      'договор найма жилого помещения',
      'распоряжение о предоставлении жилой площади',
    ],
  },
  {
    key: 'privatisation_contract',
    description:
      'Contract on the privatisation of state-owned premises, drawn up with ' +
      'the State Service for Property Issues. It arrives beside a certificate ' +
      'under Article 8.0.12 as the paper that ground rests on.',
    hints: [
      'özəlləşdirilməsi barədə müqavilə',
      'özəlləşdirmə müqaviləsi',
      'договор о приватизации',
      'договор приватизации',
    ],
  },
  {
    key: 'privatisation_consent_statement',
    description:
      'Statement of the persons living with the applicant who have a right to ' +
      'the dwelling, consenting to its privatisation. An annex to a ' +
      'privatisation, signed by third parties — not the application for ' +
      'registration.',
    hints: [
      'mənzili özəlləşdirməyə razılıq barədə ərizə',
      'özəlləşdirməyə razılıq',
      'заявление о согласии на приватизацию квартиры',
      'согласие на приватизацию',
    ],
  },
  {
    key: 'housing_office_certificate',
    description:
      'Certificate of the housing maintenance organisation (form No. 2) on ' +
      'the persons entitled to the flat and the utilities and condition of ' +
      'it. An annex to a privatisation; it is not an archival certificate.',
    hints: [
      'mənzil istismar təşkilatının arayışı',
      '2 №-li forma arayış',
      'справка жилищно-эксплуатационной организации',
      'справка формы № 2',
    ],
  },
];

// Documents confirming rights that arose before the Law entered into force, as
// listed by Presidential Decree No. 439 of 13 January 2015 and referred to by
// Article 8.0.8. Mostly Soviet-era, often in Cyrillic script and in Russian.
// Where the Decree names the same kind of paper twice — one issuer per row —
// the catalogue holds one entry and names both issuers in it, because two keys
// for one paper give the classifier two right answers to one question.
const DECREE_439: readonly CatalogueDeclaration[] = [
  {
    key: 'temporary_land_use_certificate',
    description:
      'Certificate of the right of TEMPORARY use of land, issued alongside ' +
      'the state acts of Decree point 2.1. Temporary use is not ownership, ' +
      'and this certificate says so on its face.',
    hints: [
      'torpaqdan müvəqqəti istifadə hüququna dair şəhadətnamə',
      'müvəqqəti istifadə şəhadətnaməsi',
      'свидетельство о праве временного пользования землёй',
    ],
  },
  {
    key: 'notarised_building_right_contract',
    description:
      'Notarised contract on the right to build, concluded up to 26 August ' +
      '1948 (Decree point 1.5). It grants a right to build; the contract ' +
      'allotting the plot for a dwelling is the next entry.',
    hints: [
      'tikinti hüququ barədə notariat qaydasında təsdiq edilmiş müqavilə',
      'tikinti hüququ haqqında müqavilə',
      'нотариально удостоверенный договор о праве застройки',
      'договор о праве застройки',
    ],
  },
  {
    key: 'dwelling_transfer_decision',
    description:
      "Decision of the executive committee of a soviet of people's deputies " +
      "transferring a dwelling or a flat into a person's ownership (Decree " +
      'point 1.8). It hands over a dwelling that already stands.',
    hints: [
      'mənzilin şəxsin mülkiyyətinə verilməsi barədə qərar',
      'yaşayış evinin mülkiyyətə verilməsi barədə qərar',
      'решение о передаче квартиры в собственность',
      'решение о передаче жилого дома в собственность',
    ],
  },
  {
    key: 'notarised_spousal_division_contract',
    description:
      'Notarised contract dividing a dwelling between spouses, drawn up by a ' +
      'notary or a local soviet (Decree point 1.9). An agreement between the ' +
      "two of them; a court's decision to the same effect is a court decision.",
    hints: [
      'ər-arvad arasında yaşayış evinin bölünməsi haqqında müqavilə',
      'yaşayış evinin bölünməsi haqqında müqavilə',
      'договор о разделе жилого дома между супругами',
    ],
  },
  {
    key: 'house_inventory_valuation_passport',
    description:
      'Passport on the inventory and valuation of a house held in personal ' +
      'ownership, issued by the Ministry of Communal Economy of the ' +
      'Azerbaijan SSR (Decree point 1.11). Soviet-era and about valuation; ' +
      'the technical passport of a house is a later, different paper.',
    hints: [
      'evlərin inventarizasiya və qiymətləndirilməsinə aid pasport',
      'inventarizasiya və qiymətləndirmə pasportu',
      'паспорт инвентаризации и оценки',
      'паспорта инвентаризации и оценки',
    ],
  },
  {
    key: 'cooperative_land_allocation_decision',
    description:
      "Decision of a soviet's executive committee allotting land plots to " +
      'housing-construction and garden-construction cooperatives, or to a ' +
      'housing-construction collective, up to 9 November 1991 (Decree point ' +
      '2.6). The plot goes to the cooperative, not to a person.',
    hints: [
      'mənzil-tikinti kooperativinə torpaq sahəsinin ayrılması barədə qərar',
      'bağ-tikinti kooperativinə torpaq sahəsinin ayrılması barədə qərar',
      'решение об отводе земельного участка жилищно-строительному кооперативу',
    ],
  },
];

// The papers of the application itself that the profile does not ask for. The
// general checklist of the submission names them beside the title document.
const APPLICATION_PAPERS: readonly CatalogueDeclaration[] = [
  {
    key: 'power_of_attorney',
    description:
      'Notarised power of attorney, filed when a representative applies ' +
      'instead of the owner. It says who may act for whom; it says nothing ' +
      'about the property.',
    hints: [
      'etibarnamə',
      'notariat qaydasında təsdiq edilmiş etibarnamə',
      'доверенность',
    ],
  },
  {
    key: 'legal_entity_register_extract',
    description:
      'Extract from the state register of legal entities, filed instead of an ' +
      'identity document when the applicant is a company. It identifies the ' +
      'applicant, not the property — the extract from the register of ' +
      'immovable property is a different paper.',
    hints: [
      'hüquqi şəxslərin dövlət reyestrindən çıxarış',
      'выписка из государственного реестра юридических лиц',
    ],
  },
];

// The registry's own service paperwork and the papers a submission is wrapped
// in. These are about the case rather than of it.
const REGISTRAR_SERVICE: readonly CatalogueDeclaration[] = [
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
    key: 'valuation_contract',
    description:
      'A contract for valuation of the property, drawn up between the owner ' +
      'and a valuer. It says what the valuation will cost, not what the ' +
      'property is worth.',
    hints: ['qiymətləndirmə müqaviləsi', 'договор оценки', 'договор об оценке'],
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
];

export class DocumentCatalogue {
  static readonly KNOWN = new DocumentCatalogue([
    {
      key: 'article_8',
      title:
        'Title documents — grounds for registration under Article 8 of the ' +
        'Law "On the State Register of Immovable Property"',
      documents: ARTICLE_8,
    },
    {
      key: 'decree_439',
      title:
        'Title documents — grounds under Presidential Decree No. 439, for ' +
        'rights that arose before the Law (Article 8.0.8). Mostly Soviet-era, ' +
        'often in Cyrillic script and in Russian',
      documents: DECREE_439,
    },
    {
      key: 'application_papers',
      title: 'Papers of the application itself',
      documents: APPLICATION_PAPERS,
    },
    {
      key: 'registrar_service',
      title:
        "The registry's own service paperwork, and the wrapper of the post",
      documents: REGISTRAR_SERVICE,
    },
  ]);

  readonly #groups: readonly CatalogueSection[];
  readonly #entries: readonly DocumentTypeSpec[];

  private constructor(groups: readonly CatalogueGroup[]) {
    this.#groups = groups.map(group => ({
      key: group.key,
      title: group.title,
      entries: group.documents.map(declaration =>
        DocumentTypeSpec.catalogued(declaration),
      ),
    }));
    this.#entries = this.#groups.flatMap(group => group.entries);
  }

  // Described the way a profile's own types are, because whoever classifies is
  // choosing between the two lists at once and cannot be shown them in two
  // different shapes.
  get entries(): readonly DocumentTypeSpec[] {
    return this.#entries;
  }

  // The same entries, in the order and under the headings a prompt prints
  // them: fifty keys in a flat run are read worse than four labelled groups,
  // and the grouping is a property of the list, not of one adapter's wording.
  get groups(): readonly CatalogueSection[] {
    return this.#groups;
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

export type CatalogueSection = {
  readonly key: string;
  readonly title: string;
  readonly entries: readonly DocumentTypeSpec[];
};
