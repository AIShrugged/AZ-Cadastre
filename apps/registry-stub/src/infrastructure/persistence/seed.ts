/**
 * The records the stand-in answers with.
 *
 * They were fixtures in a JSON file until the register got a database of its
 * own; they are a seed now, and the reason is not tidiness. A file could hold
 * one row per property and nothing else — no second spelling of an address, no
 * list of which papers the archive actually has — and those are the two things
 * an inspector asks the archive for (ADR-0010).
 *
 * Everything below is off the customer's own material: the two state register
 * extracts, the circulation sheets that came with them, the engineer's
 * inspection reports, and the schema sheets of the six archive registers. Where
 * a value is invented it says so. The oddities are copied deliberately — an
 * area in hectares on one paper and in square metres on another, an address in
 * the Azerbaijani legacy Cyrillic code page, a page range that is not a number
 * — because a stand-in that answered in tidy values would teach the callers to
 * expect tidy values.
 *
 * Idempotent: it upserts on the object key and replaces the rows that hang off
 * it, so running it twice is running it once.
 */
import path from 'node:path';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from './generated/client.js';
import type {
  AddressKind,
  AliasKind,
  DocumentHolding,
  RightHolderKind,
} from './generated/enums.js';

type AddressSeed = {
  kind: AddressKind;
  value: string;
  sourceDatabase?: string;
};

type RightHolderSeed = {
  name: string;
  kind: RightHolderKind;
  share?: string;
  registrationNo?: string;
  registeredOn?: string;
  previousOwner?: string;
  taxOrDocumentNo?: string;
};

type DocumentSeed = {
  name: string;
  holding: DocumentHolding;
  taxonomyRef?: string;
  number?: string;
  issuedOn?: string;
  issuingAuthority?: string;
  folder?: string;
  pages?: string;
};

/**
 * A value off one of the case's papers that no column of the spine holds. The
 * key is `<document type>:<field>` in the verification lexicon's own words —
 * `land_plot_plan:turning_points`, `designer_licence:licensee_tax_id` — so the
 * paper a value came off can be told from the key alone; the label is the
 * paper's own wording for it, and where the paper prints no heading at all it
 * says what the value is in square brackets rather than invent one.
 */
type AttributeSeed = {
  key: string;
  label: string;
  value: string;
};

type AliasSeed = {
  kind: AliasKind;
  value: string;
  issuingOffice?: string;
};

type ObjectSeed = {
  registerNo: string;
  territorialOffice: string;
  inventoryNo?: string;
  cadastralNumber?: string;
  propertyType?: string;
  district?: string;
  plotArea?: string;
  totalArea?: string;
  mainArea?: string;
  auxiliaryArea?: string;
  footprintArea?: string;
  floors?: string;
  buildYear?: number;
  ownershipType?: string;
  rightType?: string;
  landOwnershipType?: string;
  landRightType?: string;
  landCategory?: string;
  registryBookNo?: string;
  registryBookSheet?: string;
  sourceDatabase: string;
  addresses: readonly AddressSeed[];
  rightHolders: readonly RightHolderSeed[];
  documents: readonly DocumentSeed[];
  aliases?: readonly AliasSeed[];
  attributes?: readonly AttributeSeed[];
  location?: {
    folder: string;
    pages: string;
    bookNo?: string;
    sheetNo?: string;
    fundReference?: string;
    sourceDatabase: string;
  };
};

// The office every one of these cases was handled by. It is part of the object
// key, not decoration: the same property can hold one number here and another
// at the office it was transferred from.
const BAKU_1 = '1 saylı Bakı Ərazi İdarəsi';
const ABSHERON = 'Abşeron Ərazi İdarəsi';

const RECORDS: readonly ObjectSeed[] = [
  /*
   * ── The confirmed case ──────────────────────────────────────────────────
   * Rusadze Vera Vladimirovna, an individual house in Zabrat. Everything the
   * submission says about the property is what the register holds, and every
   * paper the profile asks the archive about is in the file. This is what a
   * package with nothing to answer for looks like.
   *
   * Off `Extract from the State Register of Immovable Property- Vera
   * Vladimirovna.docx` and the circulation sheet beside it. The register has no
   * cadastral number for it, which is not a gap in the seed: the extract does
   * not carry the column, and a lookup that asks about one is answered with
   * silence rather than with a disagreement.
   *
   * The papers of the submission itself — `Example application and other
   * document- Vera Vladimirovna.pdf` — add the documents after the first five
   * and every attribute below. That PDF carries no register extract, no
   * construction permit and no occupancy permit: the house was built under the
   * notification regime, which replaces the permit, and the extract is the
   * register's answer rather than part of the package. So the object columns
   * and the right holder stay what the extract says, and nothing here was
   * filled in to stand for a paper the package does not carry.
   */
  {
    registerNo: '005013055966-10301',
    territorialOffice: BAKU_1,
    propertyType: 'Fərdi yaşayış evi',
    district: 'Sabunçu rayonu',
    // Hectares here and square metres on the engineer's report of the same
    // house — both are what their paper says, and the matching rules convert.
    plotArea: '0.04 ha',
    totalArea: '162.9',
    floors: '1',
    ownershipType: 'Xüsusi',
    rightType: 'Mülkiyyət',
    landOwnershipType: 'Xüsusi',
    landRightType: 'Mülkiyyət',
    landCategory: 'Yaşayış məntəqələrinin torpaqları',
    registryBookNo: '805',
    registryBookSheet: '64',
    sourceDatabase: 'Bakı Əİ arxivi',
    addresses: [
      {
        kind: 'Current',
        value:
          'AZ 1104, Bakı şəhəri, Sabunçu rayonu, Zabrat qəsəbəsi, ' +
          'Qazı Məhəmmədov küçəsi, giriş 95A',
      },
      // `Köhnə ünvan`, printed in the same cell of the extract, under the new
      // one. It names no street at all — which is ordinary for a plot that was
      // allotted before the settlement was addressed.
      {
        kind: 'Legacy',
        value: 'Bakı Şəhəri, Sabunçu rayonu, Zabrat qəsəbəsi',
      },
      // As the inventory clerk wrote it onto the circulation sheet, in the
      // abbreviations of the trade.
      {
        kind: 'Register',
        value: 'Sabunçu ray, Zabrat qəs, Qazı Məhəmmədov küç, giriş 95A',
        sourceDatabase: 'Bakı Əİ arxivi',
      },
      /*
       * How the parcel is described on the papers of the submission itself,
       * before it had a street: the plan-scheme and the sketch design place it
       * by the road it lies beside, and the 396 decree correcting the order
       * that allotted it says the same thing the other way round. Both are in here because both are
       * what the register is actually asked — a stand-in that could not be
       * reached by the address on the surveyed drawing would be a stand-in for
       * nothing.
       */
      {
        kind: 'Register',
        value:
          'Bakı şəhəri, Sabunçu rayonu, 1-ci Zabrat qəsəbəsindən yeni ' +
          'məhəlləyə gedən yolun solunda',
        sourceDatabase: 'Bakı Əİ arxivi',
      },
      {
        kind: 'Register',
        value: 'Zabrat-1 qəsəbəsi, Yeni məhəlləyə gedən yolun sol tərəfində',
        sourceDatabase: 'Bakı Əİ arxivi',
      },
    ],
    rightHolders: [
      {
        name: 'Rusadze Vera Vladimirovna',
        kind: 'Individual',
        share: 'Tam',
        registrationNo: '1126027871',
        registeredOn: '08.05.2026',
      },
    ],
    documents: [
      {
        name: 'Ərizə',
        holding: 'Held',
        number: '1126027871',
        issuedOn: '28.01.2026',
        issuingAuthority: BAKU_1,
      },
      /*
       * Not the act that allotted the parcel: 396 corrects the surname
       * `Qusadze` to `Rusadze` in order 1471 of 29.10.1998, which did. It stays
       * the first `Sərəncam çıxarışı` row because it is the paper the confirmed
       * case was proven against, and a caller asking about the kind reads the
       * first row of it; 1471 follows below.
       */
      {
        name: 'Sərəncam çıxarışı',
        holding: 'Held',
        taxonomyRef: '439:2.3',
        number: '396',
        issuedOn: '02.12.2021',
        issuingAuthority:
          'Bakı şəhəri Sabunçu rayonu İcra Hakimiyyəti başçısının sərəncamı',
      },
      {
        name: 'Arayış',
        holding: 'Held',
        number: '3-48-2F/2-R-134-8-470/2026',
        issuedOn: '23.01.2026',
        issuingAuthority:
          'Azərbaycan Respublikası Dövlət Arxivinin Bakı Filialı',
      },
      { name: 'Texniki Pasport', holding: 'Held' },
      { name: 'Müayinə aktı', holding: 'Held' },
      // The order that allotted the 400 m² for the house, as the archive's
      // certified copy of it reads (PDF p. 5): the National Archive Fund
      // original Decree 439 asks after.
      {
        name: 'Sərəncam çıxarışı',
        holding: 'Held',
        taxonomyRef: '439:2.3',
        number: '1471',
        issuedOn: '29.10.1998',
        issuingAuthority:
          'Bakı Şəhər Sabunçu Rayon İcra Hakimiyyətinin Başçısı',
      },
      /*
       * The plan-scheme (PDF p. 8) carries no number and no date of its own.
       * These are of the letter that sent it approved (p. 7) — the only number
       * and date the scheme answers to, and not a date the scheme was drawn.
       */
      {
        name: 'Torpaq sahəsinin yerləşmə sxemi',
        holding: 'Held',
        number: '5-18/2-R-20/2-091/2-t/1/2023',
        issuedOn: '11.05.2023',
        issuingAuthority:
          'Bakı şəhəri Sabunçu Rayon İcra Hakimiyyətinin başçısının I müavini',
      },
      // The design licence and its appendix (pp. 11–12).
      {
        name: 'Lisenziya',
        holding: 'Held',
        number: 'EL-306/2022',
        issuedOn: '13.05.2022',
        issuingAuthority: 'Azərbaycan Respublikasının İqtisadiyyat Nazirliyi',
      },
      {
        name: 'Lisenziyanın əlavəsi',
        holding: 'Held',
        number: 'EL-306/2022/2',
        issuedOn: '23.08.2023',
        issuingAuthority: 'Azərbaycan Respublikasının İqtisadiyyat Nazirliyi',
      },
      // The notification (p. 9): signed and dated by the applicant, and
      // addressed to an authority rather than issued by one — which is why it
      // has no issuing authority and its addressee is an attribute.
      {
        name: 'Məlumatlandırma icraatı haqqında ərizə',
        holding: 'Held',
        issuedOn: '28.01.2026',
      },
      // The sketch design (pp. 10, 13–19). `İnvertar nömrəsi` is the only number
      // it prints, misspelling and all.
      {
        name: 'Eskiz layihəsi',
        holding: 'Held',
        number: '5648/F',
        issuingAuthority: 'MAX CONSULTING',
      },
    ],
    aliases: [
      { kind: 'Application', value: '1126027871', issuingOffice: BAKU_1 },
      { kind: 'Registration', value: '1126027871', issuingOffice: BAKU_1 },
    ],
    /*
     * Off the PDF of the submission, page by page. What it does not carry is
     * absent rather than blank: no plan date, no scale and no actual area on
     * the plan-scheme, one coordinate pair and not a list of turning points, no
     * easements, no plot size on the notification, and no construction or
     * occupancy permit at all.
     */
    attributes: [
      // ── Plan-scheme of the plot (p. 8) ──────────────────────────────────
      {
        key: 'land_plot_plan:property_address',
        label: 'torpaq sahəsinin yerləşmə sxemi',
        value:
          '1 - ci Zabrat qəsəbəsinindən yeni məhəlləyə gedən yolun solunda',
      },
      {
        key: 'land_plot_plan:owner_name',
        label: 'torpaq sahəsinin yerləşmə sxemi',
        value: 'Rusadze Vera Vladimirovnaya',
      },
      {
        key: 'land_plot_plan:land_category',
        label: 'torpaq sahəsinin yerləşmə sxemi',
        value: 'fərdi yaşayış evinin tikintisi üçün',
      },
      {
        key: 'land_plot_plan:plot_area',
        label: 'Ayrılmış torpaq sahəsi',
        value: 'S = 400.0 kv.m.',
      },
      // One pair, printed under the drawing without saying which corner it is.
      {
        key: 'land_plot_plan:turning_points',
        label: '[coordinates printed under the drawing]',
        value: 'X - 409598, 27; Y - 4481830, 29',
      },
      {
        key: 'land_plot_plan:side_lengths',
        label: '[dimension lines, clockwise from the top edge]',
        value: '19.40; 18.60; 0.60; 5.90; 4.60; 7.80; 23.00',
      },
      // The 7.80 and 4.60 sides lie along it.
      {
        key: 'land_plot_plan:adjoining',
        label: '[written along the bottom edge]',
        value: 'DALAN',
      },
      {
        key: 'land_plot_plan:plan_basis',
        label: 'torpaq sahəsinin yerləşmə sxemi',
        value:
          'Sabunçu rayon İcra Hakimiyyəti başçısının 1471 saylı ' +
          '29. 10. 1998 - ci il tarixli sərəncamı',
      },
      {
        key: 'land_plot_plan:issuing_authority',
        label: '[signature block]',
        value:
          'Sabunçu Rayon İcra Hakimiyyəti Rayon təsərrüfatı şöbəsinin müdiri',
      },
      {
        key: 'land_plot_plan:signing_official',
        label: '[signature block]',
        value: 'E. Mikayılov',
      },
      // ── The 1998 sketch scheme of the allotment, archive copy (p. 6) ────
      // In the Azerbaijani Cyrillic of its day; only what is legible.
      {
        key: 'soviet_land_record:plot_area',
        label: '[sketch scheme]',
        value: 'S=400кв.м',
      },
      {
        key: 'soviet_land_record:side_lengths',
        label: '[sketch scheme]',
        value: '24м; 16,6м',
      },
      {
        key: 'soviet_land_record:archive_reference',
        label: 'ƏSAS',
        value: 'Fond-130, siy.1, iş-476, vər.101',
      },
      // ── Order 1471 and the archive certificate (pp. 4–5) ────────────────
      {
        key: 'disposal_order:archive_reference',
        label: 'ƏSAS',
        value: 'Fond-130, siy.1, iş-476 vər.98',
      },
      // ── Design licence (pp. 11–12) ──────────────────────────────────────
      {
        key: 'designer_licence:issuing_authority_address',
        label: 'lisenziya verən orqanın ünvanı',
        value:
          'Bakı şəhəri, Nizami rayonu, Keşlə qəsəbəsi, Heydər Əliyev prospekti 155',
      },
      {
        key: 'designer_licence:activity_type',
        label: 'lisenziya verilən fəaliyyət növü',
        value:
          'Tikintisinə icazə tələb olunan və barəsində məlumatlandırma icraatı ' +
          'tətbiq olunan bina və qurğuların layihələndirilməsi',
      },
      {
        key: 'designer_licence:licensee_name',
        label: 'Lisenziya verilib',
        value: '"MAX CONSULTING" Məhdud Məsuliyyətli Cəmiyyətinə',
      },
      {
        key: 'designer_licence:licensee_address',
        label: 'hüquqi ünvanı',
        value: 'Bakı şəhəri, Yasamal rayonu, Mətbuat prospekti, ev 12B',
      },
      {
        key: 'designer_licence:licensee_tax_id',
        label: 'VÖEN',
        value: '1306641541',
      },
      {
        key: 'designer_licence:signing_official',
        label: 'Lisenziyanı imzalayan vəzifəli şəxs',
        value: 'NİYAZİ SƏFƏROV',
      },
      {
        key: 'designer_licence:signing_official_position',
        label: 'Vəzifəsi',
        value: 'NAZİR MÜAVİNİ',
      },
      {
        key: 'designer_licence:licensed_works',
        label: 'Lisenziyanın əlavəsi — SİYAHISI',
        value:
          '2. Tikinti obyektlərinin memarlıq layihələndirilməsi; ' +
          '2.1. bina və qurğuların memarlıq layihələndirilməsi; ' +
          '3. İnşaat konstruksiyalarının layihələndirilməsi; ' +
          '8. Layihələrin xüsusi bölmələrinin işlənilməsi; ' +
          '8.1. tikintinin təşkilinin layihələndirilməsi; ' +
          '8.2. smetaların tərtib edilməsi',
      },
      {
        key: 'designer_licence:appendix_signing_official',
        label: 'Lisenziyanın əlavəsi',
        value:
          'Azərbaycan Respublikası iqtisadiyyat nazirinin birinci müavini ' +
          'Elnur Əliyev',
      },
      // ── Notification to the executive authority (p. 9) ──────────────────
      // Handwritten into a printed form; the form's own words are the labels.
      {
        key: 'construction_completion_notice:addressee_authority',
        label: '[addressee line]',
        value: 'Sabunçu Rayon İcra Hakimiyyətinə',
      },
      {
        key: 'construction_completion_notice:applicant_name',
        label: 'ünvanında qeydiyyatda olan',
        value: 'Rusadze Vera Vladimirovna',
      },
      {
        key: 'construction_completion_notice:property_address',
        label: 'ünvanında yerləşən',
        value: 'Bakı şəh, Sabunçu rayonu, 1-ci Zabrat qəsəbəsi',
      },
      {
        key: 'construction_completion_notice:building_type',
        label: 'olan fərdi yaşayış (bağ) evini inşa etmişəm',
        value: 'fərdi yaşayış (bağ) evi',
      },
      {
        key: 'construction_completion_notice:building_height',
        label: 'hündürlüyü',
        value: '4,1 m',
      },
      {
        key: 'construction_completion_notice:storeys',
        label: 'mərtəbəliliyi',
        value: '1+mansard',
      },
      // Signed in the applicant's hand beside `İmza:`; the value says so and no
      // more, since a signature has no text to copy.
      {
        key: 'construction_completion_notice:signature',
        label: 'İmza',
        value: 'signed',
      },
      {
        key: 'construction_completion_notice:notice_date',
        label: 'Tarix',
        value: '28.01.2026',
      },
      // ── Sketch design (pp. 10, 13–19) ───────────────────────────────────
      {
        key: 'sketch_project:client_name',
        label: 'Sifarişçi',
        value: 'Rusadze Vera Vladimirovna',
      },
      {
        key: 'sketch_project:property_address',
        label: 'ünvanında yerləşən',
        value:
          'Bakı şəhəri, Sabunçu rayonu, 1-ci Zabrat qəsəbəsindən yeni ' +
          'məhəlləyə gedən yolun solunda',
      },
      {
        key: 'sketch_project:designer_director',
        label: 'Direktor',
        value: 'Hüseynov X.',
      },
      {
        key: 'sketch_project:drawing_scale',
        label: 'Miqyas',
        value: 'M 1:100',
      },
      {
        key: 'sketch_project:project_composition',
        label: 'ƏSAS KOMPLEKTİN CİZGİLƏRİN CƏDVƏLİ',
        value:
          'MH-1 Ümumi məlumat; BP-2 Baş plan; MH-3 Zirzəminin planı; ' +
          'MH-4 1-ci Mərtəbənin planı; MH-5 Mansardın planı; ' +
          'MH-6 "1 - 1" kəsiyi; MH-7 Ön Fasad',
      },
    ],
    location: {
      folder: '246',
      pages: '01-dən 44',
      bookNo: '805',
      sheetNo: '64',
      // `ƏSAS:` under the archive's copy of order 1471, letter for letter.
      fundReference: 'Fond-130, siy.1, iş-476 vər.98',
      sourceDatabase: 'Bakı Əİ arxivi',
    },
  },

  /*
   * ── The case that does not add up ───────────────────────────────────────
   * Əliyeva Rübabə Kavı qızı, an individual house in Buzovna. Every paper the
   * profile asks about is in the archive; the figures are not.
   *
   * The register holds 0.0309 ha. The submission's own papers do not agree with
   * each other either — the 1999 decree allotted 0.05 ha, the plan-scheme
   * surveys 0.0468 ha, and the engineer's report states 500.0 m² by the
   * documents against 490.0 m² measured. It is the plan-scheme's figure the
   * profile holds against the record, and 0.0468 ha is not 0.0309 ha. None of
   * this is invented for the seed: every figure is off a sheet of this case.
   *
   * Off `Extract from the State Register of Immovable Property- Əliyeva Rübabə`
   * and the inspection report beside it.
   */
  {
    registerNo: '003013067339-10301',
    territorialOffice: BAKU_1,
    propertyType: 'Fərdi yaşayış evi',
    district: 'Xəzər rayonu',
    plotArea: '0.0309 ha',
    totalArea: '233.20',
    floors: '2',
    ownershipType: 'Xüsusi',
    rightType: 'Mülkiyyət',
    landOwnershipType: 'Xüsusi',
    landRightType: 'Mülkiyyət',
    landCategory: 'Yaşayış məntəqələrinin torpaqları',
    sourceDatabase: 'Bakı Əİ arxivi',
    addresses: [
      {
        kind: 'Current',
        value:
          'AZ 1093, Bakı şəhəri, Xəzər rayonu, Buzovna qəsəbəsi, ' +
          '259-cu Buzovna küçəsi, giriş 14',
      },
      // The plot number the settlement knew it by before it had a street.
      {
        kind: 'Legacy',
        value: 'Bakı şəhəri, Xəzər rayonu, Buzovna qəsəbəsi, sahə 5-862',
      },
      // The same parcel as the plan-scheme and the sketch design of the
      // submission write it — which is what the register is asked about.
      {
        kind: 'Register',
        value:
          'Bakı şəhəri, Xəzər rayonu, Buzovna qəsəbəsi, 5-862 saylı torpaq sahəsi',
        sourceDatabase: 'Bakı Əİ arxivi',
      },
    ],
    rightHolders: [
      {
        name: 'Əliyeva Rübabə Kavı qızı',
        kind: 'Individual',
        share: 'Tam',
        registrationNo: '1126012493',
        registeredOn: '20.04.2026',
      },
    ],
    documents: [
      {
        name: 'Ərizə',
        holding: 'Held',
        number: '1126012493',
        issuedOn: '09.01.2026',
        issuingAuthority: BAKU_1,
      },
      /*
       * The 1999 Absheron decree the title rests on — a Decree 439 ground, and
       * the reason this case has an Absheron history at all. The submission
       * also carries a 2003 order of the Presidential Administration's
       * agricultural enterprise; the archive files the one that allotted the
       * parcel.
       */
      {
        name: 'Sərəncam çıxarışı',
        holding: 'Held',
        taxonomyRef: '439:2.3',
        number: '096',
        issuedOn: '15.04.1999',
        issuingAuthority: 'Abşeron Rayon İcra Hakimiyyəti',
      },
      {
        name: 'Arayış',
        holding: 'Held',
        number: '1-2-28/2-496/2025',
        issuedOn: '15.12.2025',
        issuingAuthority:
          'Azərbaycan Respublikası Prezidentinin İşlər İdarəsi ' +
          'İctimai-Siyasi Sənədlər Arxivi',
      },
      { name: 'Texniki Pasport', holding: 'Held' },
      { name: 'Müayinə aktı', holding: 'Held' },
    ],
    aliases: [
      { kind: 'Application', value: '1126012493', issuingOffice: BAKU_1 },
      { kind: 'Registration', value: '1126012493', issuingOffice: BAKU_1 },
    ],
    location: {
      folder: '138',
      pages: '92-129',
      fundReference: 'Ф.11165, оп.1, ед.хр.159',
      sourceDatabase: 'Bakı Əİ arxivi',
    },
  },

  /*
   * ── The property the offline pipeline reads off its own demo papers ─────
   * Not a customer case. It exists so that `pnpm dev` with every provider left
   * on `mock` shows the register stage doing its work rather than reporting the
   * property unconfirmed for want of anything to find. Its values are the
   * offline extractor's values on purpose: MOCK_VALUES in
   * packages/verification/src/infrastructure/adapters/field-extractor.adapter.ts.
   * Change one and change the other.
   */
  {
    registerNo: '3-00219',
    territorialOffice: BAKU_1,
    inventoryNo: 'İnv-7731',
    cadastralNumber: 'AZ-CAD-1024-311',
    propertyType: 'Mənzil',
    district: 'Nəsimi rayonu',
    plotArea: '642 m²',
    sourceDatabase: 'demo',
    addresses: [
      {
        kind: 'Current',
        value: 'Bakı şəhəri, Nəsimi rayonu, Azadlıq prospekti 12, mənzil 43',
      },
      // The abbreviated form the demo application is written in.
      {
        kind: 'Register',
        value: 'Bakı ş., Nəsimi r., Azadlıq pr. 12, mən. 43',
        sourceDatabase: 'demo',
      },
    ],
    rightHolders: [
      { name: 'Əliyev Elçin Vaqif oğlu', kind: 'Individual', share: 'Tam' },
    ],
    documents: [
      { name: 'Ərizə', holding: 'Held' },
      { name: 'Sərəncam çıxarışı', holding: 'Held' },
      { name: 'Arayış', holding: 'Held' },
    ],
    location: {
      folder: '05',
      pages: '12-dən 38',
      sourceDatabase: 'demo',
    },
  },

  /*
   * ── One address, two records ────────────────────────────────────────────
   * The Hövsan sovkhoz case, as the handover registers hold it: when the cases
   * moved from the Absheron office to Baku in 2008, the object was entered
   * again under the receiving office's numbering and the old entry was not
   * closed. Both are real records of the same house, and the register cannot
   * say which of them is meant — which is an answer, not a failure.
   *
   * Numbers are the shapes the handover sheets carry, filled with a case of our
   * own: the sheets themselves were shipped without their rows.
   */
  {
    registerNo: '308011000692',
    territorialOffice: ABSHERON,
    inventoryNo: '415',
    propertyType: 'Fərdi yaşayış evi',
    district: 'Xəzər rayonu',
    plotArea: '0.05 ha',
    sourceDatabase: 'Hövsan:təhvil verilən',
    addresses: [
      {
        kind: 'Register',
        value:
          'Bakı şəhəri, Xəzər rayonu, Hövsan qəsəbəsi, Nəsimi küçəsi, ev 4',
        sourceDatabase: 'Hövsan:təhvil verilən',
      },
    ],
    rightHolders: [
      {
        name: 'Məmmədov Elçin Vaqif oğlu',
        kind: 'Individual',
        share: 'Tam',
        registrationNo: '160707805',
      },
    ],
    // The Absheron presence register kept an application and an inspection act
    // for this case and never had a column for the others.
    documents: [
      { name: 'Ərizə', holding: 'Held' },
      { name: 'Müayinə aktı', holding: 'Held' },
    ],
    aliases: [
      { kind: 'Inventory', value: '415', issuingOffice: ABSHERON },
      { kind: 'Registration', value: '160707805', issuingOffice: ABSHERON },
    ],
    location: {
      folder: '31',
      pages: '06-DƏK səh. 48',
      sourceDatabase: 'Hövsan:təhvil verilən',
    },
  },
  {
    registerNo: '006011006603',
    territorialOffice: BAKU_1,
    inventoryNo: '415',
    propertyType: 'Fərdi yaşayış evi',
    district: 'Xəzər rayonu',
    plotArea: '0.05 ha',
    sourceDatabase: 'Hövsan:qəbul edilən',
    addresses: [
      {
        kind: 'Register',
        value:
          'Bakı şəhəri, Xəzər rayonu, Hövsan qəsəbəsi, Nəsimi küçəsi, ev 4',
        sourceDatabase: 'Hövsan:qəbul edilən',
      },
    ],
    // `Yeni Hüquq sahibləri` against `Hüquq sahibi (-ləri)`: the receiving
    // office recorded a different holder, and which of the two is right is the
    // question the handover registers exist to make askable.
    rightHolders: [
      {
        name: 'Məmmədova Sevil Elçin qızı',
        kind: 'Individual',
        share: 'Tam',
        registrationNo: '1120025744',
        previousOwner: 'Məmmədov Elçin Vaqif oğlu',
      },
    ],
    documents: [
      { name: 'Ərizə', holding: 'Held' },
      { name: 'Sərəncam çıxarışı', holding: 'Held' },
    ],
    aliases: [
      { kind: 'Inventory', value: '415', issuingOffice: BAKU_1 },
      { kind: 'Registration', value: '1120025744', issuingOffice: BAKU_1 },
    ],
    location: {
      folder: '31',
      pages: '49-dən 61',
      sourceDatabase: 'Hövsan:qəbul edilən',
    },
  },

  /*
   * ── A record written in the legacy Cyrillic code page ───────────────────
   * Off the example row of `пасбаза 2 Smtn.xlsx`, letter for letter. It is
   * not Russian: it is Azerbaijani typed in a Cyrillic code page that maps `ə`
   * to `я`, `ü` to `ц` and `ğ` to `ь`, and the address rules carry the table
   * that reads it.
   * A submission written in Latin resolves to this record or the table is
   * wrong, which is the whole reason it is in the seed.
   *
   * It has no document rows at all: the technical-passport database never
   * carried a column saying which papers are in the file, so the register is
   * silent about every one of them rather than saying it holds none.
   */
  {
    registerNo: '2257',
    territorialOffice: 'Гусар Ярази Идаряси',
    inventoryNo: '19093',
    propertyType: 'Гейри йашайыш сащяси - Дяйирман емалатханасы',
    district: 'Гусар',
    plotArea: '1848.4',
    totalArea: '38.4',
    footprintArea: '54.9',
    floors: '2 (ики)',
    buildYear: 1984,
    sourceDatabase: 'пасбаза',
    addresses: [
      {
        kind: 'Register',
        value: 'Гусар шящяри, Щ.З.Таьыйев кцчяси',
        sourceDatabase: 'пасбаза',
      },
    ],
    rightHolders: [
      { name: 'Язизов Ариф Мювлуд оьлу', kind: 'Individual', share: 'Tam' },
    ],
    documents: [],
    aliases: [{ kind: 'TechnicalPassport', value: '2257' }],
    location: {
      folder: '19',
      pages: '15-20',
      sourceDatabase: 'пасбаза',
    },
  },
];

/**
 * The package root, from this file's place inside `build/`. The seed runs
 * outside Nest and outside Prisma's own env loading, so it reads the same two
 * files `prisma.config.ts` does — `.env.local` first, because `loadEnvFile`
 * never overwrites a variable that is already set.
 */
function loadEnvironment(): void {
  const root = path.join(import.meta.dirname, '..', '..', '..');

  for (const file of ['.env.local', '.env']) {
    try {
      process.loadEnvFile(path.join(root, file));
    } catch {
      // file absent — fall back to the ambient environment
    }
  }
}

async function seed(): Promise<void> {
  loadEnvironment();

  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. The seed writes to the register's own " +
        'database — see apps/registry-stub/.env.example.',
    );
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });

  try {
    for (const record of RECORDS) {
      await write(prisma, record);
    }

    const held = await prisma.registryObject.count();

    // A script and not the service: there is no Nest container here to take a
    // logger from, and whoever ran it is watching this line.
    process.stdout.write(`Register seeded: ${held} objects.\n`);
  } finally {
    await prisma.$disconnect();
  }
}

async function write(prisma: PrismaClient, record: ObjectSeed): Promise<void> {
  const {
    addresses,
    rightHolders,
    documents,
    aliases = [],
    attributes = [],
    location,
    ...object
  } = record;

  const stored = await prisma.registryObject.upsert({
    where: {
      territorialOffice_registerNo: {
        territorialOffice: record.territorialOffice,
        registerNo: record.registerNo,
      },
    },
    create: object,
    update: object,
  });

  // Replaced rather than merged: the seed is the whole of what the register
  // holds about these properties, and a row left over from an earlier shape of
  // it would be a record nobody wrote.
  await prisma.registryAddress.deleteMany({ where: { objectId: stored.id } });
  await prisma.registryRightHolder.deleteMany({
    where: { objectId: stored.id },
  });
  await prisma.registryDocument.deleteMany({ where: { objectId: stored.id } });
  await prisma.registryAlias.deleteMany({ where: { objectId: stored.id } });
  await prisma.archiveLocation.deleteMany({ where: { objectId: stored.id } });
  await prisma.registryAttribute.deleteMany({ where: { objectId: stored.id } });

  await prisma.registryAddress.createMany({
    data: addresses.map((address, position) => ({
      ...address,
      objectId: stored.id,
      position,
    })),
  });
  await prisma.registryRightHolder.createMany({
    data: rightHolders.map((holder, position) => ({
      ...holder,
      objectId: stored.id,
      position,
    })),
  });
  await prisma.registryDocument.createMany({
    data: documents.map((document, position) => ({
      ...document,
      objectId: stored.id,
      sourceDatabase: record.sourceDatabase,
      position,
    })),
  });
  await prisma.registryAlias.createMany({
    data: aliases.map((alias, position) => ({
      ...alias,
      objectId: stored.id,
      sourceDatabase: record.sourceDatabase,
      position,
    })),
  });
  await prisma.registryAttribute.createMany({
    data: attributes.map((attribute, position) => ({
      ...attribute,
      objectId: stored.id,
      sourceDatabase: record.sourceDatabase,
      position,
    })),
  });

  if (location) {
    await prisma.archiveLocation.create({
      data: { ...location, objectId: stored.id },
    });
  }
}

await seed();
