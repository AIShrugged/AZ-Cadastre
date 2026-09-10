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
    key: 'state_property_disposal_act',
    description:
      'Act of an executive authority or a municipality alienating, leasing, ' +
      'granting the use of or mortgaging immovable property owned by the ' +
      'state or by a municipality — a municipal sale-purchase act and the ' +
      'like (Article 8.0.1). It disposes of property the state owns; it is ' +
      'not the executive order allotting an applicant a parcel to build on.',
    hints: [
      'bələdiyyənin alqı-satqı aktı',
      'daşınmaz əmlakın özgəninkiləşdirilməsinə dair akt',
      'özgəninkiləşdirmə aktı',
      'акт купли-продажи муниципалитета',
      'акт об отчуждении недвижимого имущества',
    ],
  },
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
    key: 'registration_certificate',
    description:
      'Registration certificate confirming a right over immovable property, ' +
      'issued by an executive authority up to 6 July 2006 (Article 8.0.5) — ' +
      'the booklet the technical inventory bureaus issued, often produced ' +
      'together with a technical passport. It records an existing right; it ' +
      'is not the inventory passport itself.',
    hints: ['qeydiyyat vəsiqəsi', 'регистрационное удостоверение'],
  },
  {
    key: 'property_right_certificate',
    description:
      'Act or certificate confirming a right over immovable property, issued ' +
      'by an executive authority: up to 6 July 2006 under Article 8.0.5, and ' +
      'between 6 July 2006 and 24 June 2009 under Article 8.0.12. The two ' +
      'articles name the same paper in two windows, so the date decides which ' +
      'ground it is and never whether the document is this one.',
    hints: [
      'daşınmaz əmlaka dair şəhadətnamə',
      'daşınmaz əmlak üzərində hüquqları təsdiq edən şəhadətnamə',
      'mülkiyyət hüququna dair şəhadətnamə',
      'свидетельство на недвижимое имущество',
      'свидетельство о праве собственности на недвижимое имущество',
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
    key: 'operation_acceptance_act',
    description:
      'Act accepting a completed building into operation, issued by the local ' +
      'executive authority for buildings raised before 1 January 2013 ' +
      '(Article 8.0.9). It closes the construction; a permit to occupy issued ' +
      'under the later Code is a different paper.',
    hints: [
      'istismara qəbul aktı',
      'yaşayış evinin istismara qəbul aktı',
      'акт приёмки в эксплуатацию',
      'акт приёмки жилого дома в эксплуатацию',
    ],
  },
  {
    key: 'construction_permit_decision',
    description:
      'Decision of the relevant executive authority permitting a building to ' +
      'be constructed (Articles 8.0.9.2, 8.0.10.1). It permits work that has ' +
      'not started; it says nothing about a finished building.',
    hints: [
      'tikilinin inşa edilməsinə icazə barədə qərar',
      'tikintiyə icazə barədə qərar',
      'tikinti icazəsi',
      'решение о разрешении на строительство',
      'разрешение на строительство',
    ],
  },
  {
    key: 'architectural_planning_section',
    description:
      'Architectural and planning section of a construction design, required ' +
      'of objects that need a permit and of those under the notification ' +
      'procedure (Articles 8.0.10.1, 8.0.10.2). It is a section OF an ' +
      "approved design, not the designer's sketch design of the house.",
    hints: [
      'layihənin memarlıq-planlaşdırma bölməsi',
      'memarlıq-planlaşdırma bölməsi',
      'архитектурно-планировочный раздел проекта',
      'архитектурно-планировочная часть проекта',
    ],
  },
  {
    key: 'operation_permit',
    description:
      'Permit to put a completed object into operation, issued under the ' +
      'Urban Planning and Construction Code (Articles 8.0.10.1, 8.0.10-1). ' +
      'A permit granted by an authority, not an acceptance act signed by a ' +
      'commission.',
    hints: [
      'istismara icazə',
      'obyektin istismarına icazə',
      'разрешение на эксплуатацию',
    ],
  },
  {
    key: 'construction_completion_notice',
    description:
      'The notification an owner sends the authority once construction under ' +
      'the notification procedure is finished (Article 8.0.10.2). It is sent ' +
      'BY the owner; nothing is granted by it.',
    hints: [
      'tikintinin başa çatması barədə məlumat',
      'məlumatlandırma icraatı barədə bildiriş',
      'уведомление о завершении строительства',
      'информация о завершении строительства',
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
    key: 'soviet_land_record',
    description:
      'Land record issued by the economic department, or by the technical ' +
      'inventory bureau (BTI), of the executive committee of a local soviet ' +
      '(Decree points 1.1 and 1.2). A register entry about a plot, from the ' +
      'Soviet era.',
    hints: [
      'torpaq qeydləri',
      'torpaq qeydi',
      'земельные записи',
      'земельная запись',
    ],
  },
  {
    key: 'land_right_state_act',
    description:
      'State act on the right of ownership, possession or use of a land plot, ' +
      "issued by a city or district soviet's executive committee (Decree " +
      'points 1.3 and 2.1). Headed "state act"; it is the plot it concerns, ' +
      'not a building on it.',
    hints: [
      'torpaqdan istifadə hüququna dair dövlət aktı',
      'torpaq sahəsinə dair dövlət aktı',
      'dövlət aktı',
      'государственный акт на право пользования землёй',
      'государственный акт на землю',
    ],
  },
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
    key: 'land_allocation_decision',
    description:
      "Decision of a soviet of workers' or people's deputies allotting land " +
      'plots — Soviet-era under Decree point 1.4, and between 9 November 1991 ' +
      'and 19 December 1995 under point 2.2. The two points are the same ' +
      'paper in two periods.',
    hints: [
      'torpaq sahələrinin ayrılması barədə qərar',
      'torpaq sahəsinin ayrılması haqqında qərar',
      'решение об отводе земельных участков',
      'решение о выделении земельного участка',
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
    key: 'notarised_land_allocation_contract',
    description:
      'Notarised contract allotting a land plot for the construction of a ' +
      'dwelling under personal ownership, concluded after 26 August 1948 ' +
      '(Decree point 1.6). It allots the plot rather than granting a right to ' +
      'build on somebody else’s.',
    hints: [
      'yaşayış evlərinin tikintisi üçün torpaq sahələrinin verilməsi haqqında müqavilə',
      'torpaq sahəsinin verilməsi haqqında notariat qaydasında təsdiq edilmiş müqavilə',
      'договор о предоставлении земельного участка для строительства жилого дома',
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
    key: 'household_book_extract',
    description:
      'Extract from a household registration book, or a certificate issued on ' +
      'the basis of such an extract, given before 1 January 2001 for houses ' +
      'built by that date (Decree point 2.3). Often produced as an archival ' +
      'EXTRACT — a copy of the book entry — rather than as a certificate an ' +
      'archive writes in its own words.',
    hints: [
      'təsərrüfatbaşına kitabından çıxarış',
      'təsərrüfat kitabından çıxarış',
      'arxiv çıxarışı',
      'выписка из похозяйственной книги',
      'архивная выписка',
    ],
  },
  {
    key: 'kolkhoz_allocation_decision',
    description:
      'Decision of the general meeting of the members of a collective farm ' +
      '(kolkhoz), or of their delegates, allotting homestead land plots for ' +
      'the construction of dwellings and garden houses (Decree point 2.5).',
    hints: [
      'kolxoz üzvlərinin ümumi yığıncağının qərarı',
      'kolxoz üzvlərinin yığıncağının qərarı',
      'решение общего собрания членов колхоза',
    ],
  },
  {
    key: 'sovkhoz_allocation_order',
    description:
      'Order of the head of a state farm (sovkhoz) or of another ' +
      'state-subordinated agricultural enterprise allotting a homestead plot ' +
      '(Decree point 2.5-1). One manager signs it, where the kolkhoz answer ' +
      'is a meeting of members.',
    hints: [
      'sovxoz rəhbərinin əmri',
      'kənd təsərrüfatı müəssisəsi rəhbərinin əmri',
      'приказ руководителя совхоза',
      'распоряжение главы совхоза',
    ],
  },
  {
    key: 'bound_land_book_extract',
    description:
      'Extract from the bound (laced) land books kept by a kolkhoz or a ' +
      'sovkhoz about a homestead plot (Decree points 2.5 and 2.5-1). A copy ' +
      'of a farm register entry, not of a household registration book.',
    hints: [
      'qaytanlanmış torpaq kitabından çıxarış',
      'torpaq kitabından çıxarış',
      'выписка из прошнурованной земельной книги',
      'выписка из земельной книги',
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
  {
    key: 'homestead_land_allocation_decision',
    description:
      'Decision allotting a homestead land plot for the construction of a ' +
      'dwelling, taken before 1 January 2001 by the representative of the ' +
      'local executive authority for an administrative-territorial unit ' +
      '(Decree point 2.7).',
    hints: [
      'həyətyanı torpaq sahəsinin ayrılması barədə qərar',
      'həyətyanı torpaq sahəsinin verilməsi barədə qərar',
      'решение об отводе приусадебного земельного участка',
    ],
  },
  {
    key: 'apartment_demolition_decision',
    description:
      'Decision of a local executive authority to demolish dwelling-type ' +
      'flats and raise an individual dwelling in their place, produced with ' +
      'the design agreed with that authority (Decree point 2.8).',
    hints: [
      'mənzillərin sökülərək fərdi yaşayış evinin inşası barədə qərar',
      'mənzillərin sökülməsi barədə qərar',
      'решение о сносе квартир и строительстве индивидуального жилого дома',
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
  {
    key: 'technical_passport',
    description:
      'Technical passport of a building drawn up by the technical inventory ' +
      'bodies: the storeys, rooms, areas and year of a house, with its ' +
      'measured drawings. Where it was drawn up before 1 January 2001 and ' +
      'states the size of the adjoining plot it is itself a ground under ' +
      'Decree point 2.4. It describes what stands; it does not grant anything.',
    hints: [
      'texniki pasport',
      'texniki pasportlar',
      'yaşayış evinə dair texniki pasport',
      'технический паспорт',
      'технические паспорта',
    ],
  },
  {
    key: 'state_register_extract',
    description:
      'Extract from the State Register of Immovable Property: what the ' +
      'register already holds about the property, under an extract number and ' +
      'a date. It reports a registration that has happened; it is not a ' +
      'ground for making one.',
    hints: [
      'daşınmaz əmlakın dövlət reyestrindən çıxarış',
      'выписка из государственного реестра недвижимого имущества',
      'выписка из реестра недвижимого имущества',
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
