/**
 * The archive's own signed copy in the Hümbətov package, as its text layer
 * reads (COMM-145).
 *
 * Not invented and not tidied: this is `textLayerOf` run over the PDF the code
 * `https://qr.esd.milliarxiv.gov.az/info/alOOwj1h…` leads to, page by page, on
 * 23 September 2026. It is here because the reading of this sheet is what
 * COMM-145 was about — a covering letter with a 1999 order copied out under it
 * in prose, no panel of labelled rows anywhere on it, and a label reader that
 * matched `ünvan` inside `ünvanında qeydiyyatda olan` and reported the archive
 * as contradicting a paper that agrees with it line for line.
 *
 * The link the file came from is presigned and lives an hour, so the file
 * cannot be checked back into the repository under it; the text can, and the
 * text is what every reader of this sheet sees.
 */
export const HUMBETOV_ARCHIVE_SHEET: readonly string[] = [
  `AZƏRBAYCAN RESPUBLİKASININ
MİLLİ ARXİV İDARƏSİ
AZƏRBAYCAN RESPUBLİKASI
DÖVLƏT ARXİVİNİN BAKI FİLİALI
AZ1106 Bakı şəhəri, Z. Bünyadov pr., 3 Tel.: (+99412) 562-96-30 Faks: (+99412) 562 97 56 Veb:
milliarxiv.gov.az Elektron poçt: arda_baki@milliarxiv.gov.az
14 yanvar 2026-cı il 3-48-2F/2-H-268-8-223/2026
Bakı şəh., Maştağa qəs., Tərəvəz Südçülük Sovx.
ünvanında qeydiyyatda olan
Vət. Hümbətov Yavər Kərim oğlunun
etibarnamə üzrə nümayəndəsi
Vət. Hümbətov Elçin Yavər oğluna
4 saylı Bakı “Asan Xidmət” Mərkəzindən daxil olmuş 05.01.2026-cı il tarixli müraciətinizə
əsasən vət. Hümbətov Yavər Kərim oğlu barəsində Xətai rayon İH-nin arxiv fondu üzrə
21.04.1999-cu il tarixli, 100 saylı sərəncamından təsdiq edilmiş arxiv çıxarışı 1 (bir) vərəqdən
ibarət Sizə göndərilir. Sərəncama vət. Hümbətov Yavər Kərim oğluna məxsus cizgi əlavə
edilməmişdir.
Direktor: Ağakişi Allahverdiyev`,
  `Arxiv çıxarışı
XƏTAİ RAYONU İCRA HAKİMİYYƏTİNİN BAŞÇISI
SƏRƏNCAM № _100_ “21” _04_1999-cu il.
“Qəsəbədaxili ərazidə torpaq
sahəsinin ayrılması haqqında”
Xətai rayon İcra Hakimiyyətinə aşağıda göstərilən vətəndaşlar müraciət edərək, ailə tərkibinin
böyüklüyünü, mənzil şəraitinin qeyri-qənaətbəxş olduğunu nəzərə alaraq, qəsəbədaxili ərazidə fərdi ev tikintisi
üçün torpaq sahəsinin ayrılmasını xahiş etmişdir.
Vətəndaşların mənzilə olan ehtiyacını nəzərə alaraq, qəsəbədaxili ərazilərdə fərdi yaşayış evləri tikintisi
üçün torpaq sahələrinin ayrılması rayon İcra hakimiyyətinin səlahiyyətində olması haqqında Bakı şəhər XDS
İcraiyyə komitəsinin 27.01.89-cu il tarixli 13.713 saylı Qərarını, Azərbaycan Respublikasının rayonlarında,
şəhərlərində, Dövlət hakimiyyət və idarəetmə orqanları haqqında Əsasnamənin 13 mad. “Q” bəndini rəhbər
tutaraq
QƏRARA ALIRAM :
...
- Maştağa Tərəvəz – Südçülük sovxozunda yaşayan vət. Yavər Kərim oğlu Hümbətova, Əbilov küç. 17. 18
saylı evin yaxınlığında, cizgidə göstərilən sahədə 0,06 ha;
...
2. Yaşayış evinin layihə smeta sənədlərinin tərtib edilməsi rayon layihə-smeta bürosuna həvalə olunsun
və rayonun Baş meʺmarı ilə razılaşdırılsın.
3. Yaşayış evinin tikintisinin və layihə sənədlərinin tərtib edilməsi vətəndaşların hesabına yerinə yetirilsin.
4. Ətraf ərazinin abadlaşdırılması və yolların salınması vətəndaşlara həvalə olunsun.
5. Vətəndaşlara tapşırılsın ki, fərdi yaşayış evinin tikintisi iki il müddətinə başa çatdırılsın.
6. Tikintisi başa çatmış fərdi yaşayış evinin qəbul edilməsi və hüquqi qeydiyyata alınması məsələsinə
baxılması “Evlərin hüquqi qeydiyyata alınması” komissiyasına həvalə olunsun.
7. Sərəncamın surəti r-n Polis İdarəsinə, r-n MKTB-nə, r-n Vergi Müfəttişliyinə, r-n GEM-nə, r-n Yanğından
Mühafizə idarəsinə, r-n İH-nin “Meʺmarlıq və Tikinti” şöʺbəsinə və vətəndaşlara göndərilsin;
8. Sərəncamın icrasına nəzarət rayon İH-nin “Meʺmarlıq və Tikinti” şöʺbəsinə həvalə olunsun.
QEYD: Sərəncama vət. Hümbətov Yavər Kərim oğluna imza: G. Cəlilov
məxsus cizgi əlavə edilməmişdir.
ƏSAS: Fond-128, siy.1, iş-1043, vər.-69, 70, 72.`,
];

/**
 * What the sheet above actually states, on the eight lines the comparison holds
 * a paper against — read by a person, which is the answer any reader of it has
 * to come to.
 *
 * `decree_item` is null because the order prints no item of Decree 439 on it.
 * That is the honest answer and not a gap to be filled: the numbered points of
 * the order's own operative part are not items of the Decree.
 */
export const HUMBETOV_ARCHIVE_LINES = {
  document_no: '100',
  issue_date: '21.04.1999',
  issuing_authority: 'XƏTAİ RAYONU İCRA HAKİMİYYƏTİNİN BAŞÇISI',
  holder_name: 'Hümbətov Yavər Kərim oğlu',
  property_address: 'Əbilov küç. 17. 18 saylı evin yaxınlığında',
  plot_area: '0,06 ha',
  decree_item: null,
  archive_reference: 'Fond-128, siy.1, iş-1043, vər.-69, 70, 72',
} as const;

/**
 * What the label reader answered off that same sheet before COMM-145 — the four
 * lines it "found", each the tail of the sentence the label happened to fall
 * inside. Two of them were reported to the inspector as the archive
 * contradicting the paper.
 */
export const READ_AS_FRAGMENTS = {
  // `ünvan`, inside `ünvanında qeydiyyatda olan`
  property_address: 'nda qeydiyyatda olan',
  // `sahəsi`, inside `torpaq sahəsinin ayrılmasını xahiş etmişdir.`
  plot_area: 'nin ayrılmasını xahiş etmişdir.',
  // `bənd`, inside `bəndini rəhbər`
  decree_item: 'ni rəhbər',
  // `fond`, inside `arxiv fondu üzrə`
  archive_reference: 'u üzrə',
} as const;
