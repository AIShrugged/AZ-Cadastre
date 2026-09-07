/**
 * What the archive's own registers call their columns, and which of the
 * register's fields each name means.
 *
 * The six workbooks the customer stores are six shapes written by four
 * offices over thirty years, and between them they spell one idea a dozen ways:
 * an address is `Ünvan`, `Ünvanı`, `Əmlakın ünvanı`, `Adress` and, in the files
 * still in the Azerbaijani Cyrillic code page, `Цнван`. Mapping them is a
 * dictionary and not a parser — every spelling that has actually been seen is
 * listed, and a header nobody has seen is left unread rather than guessed at.
 *
 * The lexicon is per column and not per sheet on purpose. A sheet is recognised
 * by the register it belongs to (ADR-0012); what its columns mean is the same
 * question in all forty of them, and asking it once is what makes the next
 * register file a catalogue entry rather than a parser.
 */

/**
 * One thing an archive register row can say.
 *
 * Not the register's own fields: those are spread across six models, and a row
 * of a source register carries a flat handful of values that the mapping then
 * places.
 */
export type NativeField =
  // ── what the row is keyed by ────────────────────────────────────────────
  | 'rowNo'
  | 'registerNo'
  | 'registrationNo'
  | 'inventoryNo'
  | 'cadastralNumber'
  | 'registerCode'
  | 'subUnitCode'
  | 'applicationNo'
  // The numbers of the papers themselves, which is what most of these
  // registers are keyed by for want of anything else.
  | 'certificateNo'
  | 'certificateDate'
  | 'contractNo'
  | 'contractDate'
  | 'contractType'
  | 'stateActNo'
  | 'technicalPassportNo'
  // ── the same pair, at the office the case came from or went to ──────────
  | 'absheronRegisterNo'
  | 'absheronRegistrationNo'
  | 'bakuRegisterNo'
  | 'bakuRegistrationNo'
  // ── where and what ──────────────────────────────────────────────────────
  | 'district'
  | 'address'
  | 'secondAddress'
  | 'objectName'
  | 'propertyType'
  | 'ownershipType'
  | 'privatisationMethod'
  | 'floors'
  | 'totalArea'
  | 'mainArea'
  | 'auxiliaryArea'
  | 'plotArea'
  | 'footprintArea'
  | 'landArea'
  | 'buildYear'
  // ── who ─────────────────────────────────────────────────────────────────
  | 'holderName'
  | 'newHolderName'
  | 'previousOwner'
  | 'balanceHolder'
  | 'headAuthority'
  // ── where the paper is ──────────────────────────────────────────────────
  | 'folder'
  | 'pages'
  | 'pageFrom'
  | 'pageTo'
  // ── the rest ────────────────────────────────────────────────────────────
  | 'issuedOn'
  | 'handoverDate'
  | 'note';

/**
 * A header as the lexicon keys it: lowercase, without diacritics, without
 * punctuation and without spaces.
 *
 * `№` becomes `no` rather than nothing, because half of these headers are `№`,
 * `№-si` or `Sıra №` and dropping the sign would merge them into one key. The
 * Azerbaijani letters fold to their ASCII neighbours so that `Ünvanı` and
 * `UNVANI` are one key; the Cyrillic ones are left as they are and listed as
 * their own spellings, because folding them onto Latin would lose which code
 * page a file was written in — and that is the one thing telling
 * `QEYRI-YAS.-SBTİ` from every other register.
 */
export function foldHeader(header: string): string {
  return header
    .toLowerCase()
    .replaceAll('№', 'no')
    .replaceAll('ə', 'e')
    .replaceAll('ğ', 'g')
    .replaceAll('ı', 'i')
    .replaceAll('ö', 'o')
    .replaceAll('ş', 's')
    .replaceAll('ü', 'u')
    .replaceAll('ç', 'c')
    .normalize('NFD')
    .replaceAll(/[̀-ͯ]/g, '')
    .replaceAll(/[^a-z0-9Ѐ-ӿ]/g, '');
}

/**
 * Every spelling of every column, folded, against what it means.
 *
 * Read off the header rows of the six workbooks — both rows of each, since a
 * sheet carries the office's own Azerbaijani header and an English one written
 * beside it, and the English row is what settles the ambiguous ones: a bare `№`
 * is a row number in `Q.yas-icara` and a state act number in `KADASTR`, and
 * only the English header says which.
 */
const ENTRIES: readonly (readonly [NativeField, readonly string[]])[] = [
  ['rowNo', ['sira', 'sirano', 'siranosi', 'no', 'n', 'rowno', 'сыраno']],

  ['registerNo', ['reyestrnomresi', 'registrnomresi', 'reyestrnosi', 'emlakinreyestrnomresi', 'registernumber', 'registrynumber', 'regisrtyno', 'registryno', 'реиестрnoси']], // prettier-ignore
  ['registrationNo', ['qeydiyyatnomresi', 'qeydiyyatnomresiarxiv', 'isno', 'registrationnumber', 'registrationno']], // prettier-ignore
  ['inventoryNo', ['inventarno', 'inventarnomresi', 'inventararxiv', 'emlaktexpasinventar', 'inventoryno', 'inventorynumber', 'inventoryreferencenumber', 'инвентарнюмряси']], // prettier-ignore
  ['cadastralNumber', ['kadastrnomresi', 'cadastralnumber']],
  ['registerCode', ['emlakinregistrkodu', 'registrkodu', 'registercode']],
  ['subUnitCode', ['althisseninkodu', 'althisseninnomresi', 'subunitcode', 'subunitnumber']], // prettier-ignore
  ['applicationNo', ['muracietno', 'erizenomresi', 'bakieiuzreerizenomresi', 'bakieiuzreerzienomresi', 'applicationno', 'bakuterritorialofficeapplicationnumber']], // prettier-ignore

  ['certificateNo', ['sehadetname', 'sehadetnameno', 'sehadetnamenosi', 'sehadetnamenomresi', 'sehadno', 'sehadetnamevemuqavileninnosi', 'sehadetnameveemdkdemuqavilelerinnosi', 'certificate', 'certificateno', 'certificateandcontractno', 'certificatenoandemdkcontractno']], // prettier-ignore
  ['certificateDate', ['sehadetnamenintarixi', 'dateofcertificate']],
  ['contractNo', ['muqavilenomresi', 'muqavileninnomresi', 'emdkdemuqavilelerinnosi', 'contractnumber', 'emdkcontractno']], // prettier-ignore
  ['contractDate', ['muqaviletarixi', 'muqtarixi', 'muqavilenintarixi', 'dateofcontract']], // prettier-ignore
  ['contractType', ['muqavilenintipi', 'contracttype']],
  ['stateActNo', ['nojn', 'jn', 'dovletakti', 'stateactnumber', 'stateactno']],
  ['technicalPassportNo', ['pasportnomresi', 'texnikipasportnomresi', 'passportnumber', 'pasportno', 'technicalpassportno', 'паспортнюмряси']], // prettier-ignore

  ['absheronRegisterNo', ['abseroneireyestrnomresi', 'abseroneiuzrereyestrnomresi', 'absheronterritorialofficeregistrynumber', 'absheronterritorialofficeregisrtynumber']], // prettier-ignore
  ['absheronRegistrationNo', ['abseroneiuzreqeydiyyatnomresi', 'registrationnumberwiththeabsheronterritorialoffice']], // prettier-ignore
  ['bakuRegisterNo', ['bakieiuzrereyestrnomresi', 'bakuterritorialofficeregisrtynumber', 'bakuterritorialofficeregistrynumber']], // prettier-ignore
  ['bakuRegistrationNo', ['bakieiuzreqeydiyyatnomresi', 'bakuterritorialofficeregistrationnumber']], // prettier-ignore

  ['district', ['rayon', 'rayonunadi', 'rayonadi', 'region', 'district', 'districtname', 'реэион']], // prettier-ignore
  [
    'address',
    ['unvan', 'unvani', 'emlakinunvani', 'address', 'adress', 'цнван'],
  ],
  ['secondAddress', ['unvan2arxiv', 'address2archive']],
  ['objectName', ['obyektinadi', 'emlakinadi', 'obyekt', 'emlak', 'emlakinterkibiobyektinadi', 'nameoftheobject', 'object', 'property', 'compositionofthepropertynameoftheobject', 'обиектинады']], // prettier-ignore
  ['propertyType', ['emlakinnovu', 'dasinmazemlakinnovu', 'typeoftheproperty']],
  ['ownershipType', ['mulkiyyetnovu', 'mulkiyyetinnovu', 'ownershiptype', 'typeoftheownership']], // prettier-ignore
  ['privatisationMethod', ['hansiyolileozellesib', 'privatisationmethod']],
  ['floors', ['mertebe', 'mertebesi', 'floor', 'floornumber', 'мяртябяси']],
  ['totalArea', ['sahesi', 'sahe', 'sahekvm', 'emlakinumumisahesi', 'umumisahe', 'area', 'totalarea', 'generalarea', 'totalareaoftheproperty', 'totalareaofthepropertysqm', 'цмумисащя']], // prettier-ignore
  ['mainArea', ['esassahe', 'mainarea', 'livingarea', 'ясассащя']],
  ['auxiliaryArea', ['yardimcisahe', 'auxiliaryarea', 'иардымчысащя']],
  ['plotArea', ['torpaqsahesi', 'torpaqsahesikvm', 'landarea', 'landareasqm', 'торпагсащяси']], // prettier-ignore
  ['footprintArea', ['tikintialtitorpaqsahesi', 'tikilialtisahe', 'landareaunderconstruction', 'landareaunderconstructionsqm', 'buildingfootfrintarea', 'footfrintarea', 'тикилиалтысащя']], // prettier-ignore
  // `Tikildiyi il` — the only column in any of these registers that is
  // arithmetic, and the only one read as a number (ADR-0011 §3).
  ['buildYear', ['tikildiyiil', 'buildingdate', 'тикилдиииил']],
  ['landArea', ['umumitorpaqsahesi', 'totallandarea', 'totallandareasqm']],

  ['holderName', ['balanssaxmulkiyyetci', 'баланссахмцлкиииятчи', 'propertyowner', 'rightowner', 'fizikisexsinadi', 'adsoyadataadi', 'soyadiadiatasininadi', 'huquqsahibileri', 'huquqsahibleri', 'huquqsahibi', 'alicininadi', 'sehadetnameverilir', 'sehadetnameverilirfizikisexsinadi', 'sehadetnameverilirhuquqisexsinadifizikisexsinsaa', 'muqavileverilir', 'muqavileverilirfizikisexsinadi', 'muqavilesehadetnameverilir', 'obyektinadisehadetnameverilir', 'mulkiyyetintamadi', 'fio', 'nameoftheindividual', 'nameofthepurchaser', 'rightholder', 'rightholders', 'surnamenamepatronymic', 'surnamenameandpatronymic', 'surnamenamepartronymic', 'namesurnameandpatronymic', 'namesurnamepatronymic', 'fullnameofthepropertyowner', 'nameoftherightowner', 'nameoftheobjectcertificateissuedto', 'certificateissuedto', 'contractissuedto', 'мцлкиииятинтамады']], // prettier-ignore
  ['newHolderName', ['yenihuquqsahibleri', 'newrightholders']],
  ['previousOwner', ['ilkinmulkiyyetci', 'originalowner']],
  ['balanceHolder', ['balanssaxlayici', 'balanssaxlayicikecmisbalanssaxlayiciteskilatinadi', 'balanceholdingorganisation']], // prettier-ignore
  ['headAuthority', ['basidare', 'basidarekecmisbasidare', 'headauthority']],

  ['folder', ['qovluq', 'folder']],
  ['pages', ['sehife', 'sehifeler', 'page', 'pages']],
  ['pageFrom', ['sehifebaslangic', 'pagefrom']],
  ['pageTo', ['sehifeson', 'pageto']],

  ['issuedOn', ['tarix', 'tarixi', 'tertibedilmetarixi', 'date', 'issuingdate', 'preparationdate', 'preparing', 'тарих', 'тяртибедилмятарихи']], // prettier-ignore
  ['handoverDate', ['tehvilverilmetarixi', 'dateofhandover']],
  ['note', ['qeyd', 'qeydler', 'elavemelumat', 'note', 'notes', 'additionalinformation', 'reyestrkitabindancixarilmahaqdaqeyd', 'noteonremovalfromtheregistrybook', 'реиестркитабынданчыхарылмащагдагеид', 'геид']], // prettier-ignore
];

const LEXICON: ReadonlyMap<string, NativeField> = new Map(
  ENTRIES.flatMap(([field, headers]) =>
    headers.map(header => [header, field] as const),
  ),
);

/** Every folded spelling the lexicon knows, for the fingerprint to score against. */
export const KNOWN_HEADERS: ReadonlySet<string> = new Set(LEXICON.keys());

/**
 * What one column means, given every spelling the sheet heads it with.
 *
 * A column carries as many headers as the sheet has header rows — the office's
 * own and the English one written beside it — and they are tried in order, with
 * one exception: `rowNo` never wins over another reading. A bare `№` folds to
 * the same key whether it means "row number" or "state act number", and the
 * sheet that means the second says so in its English header. Preferring the
 * more specific reading is therefore not a heuristic but the only way to read
 * `KADASTR` and `Q.yas-icara`, which head the same column the same way and mean
 * different things by it.
 */
export function fieldOfColumn(headers: readonly string[]): NativeField | null {
  let fallback: NativeField | null = null;

  for (const header of headers) {
    const field = LEXICON.get(foldHeader(header));

    if (!field) continue;
    if (field !== 'rowNo') return field;
    fallback ??= field;
  }

  return fallback;
}
