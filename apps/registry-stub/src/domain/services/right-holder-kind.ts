/**
 * Whether a name in the `Hüquq sahibi` column is a person or a firm.
 *
 * Every one of these registers keeps them in the same free-text column —
 * `Əliyeva Rübabə Kavı qızı` and `"Qərənfil 97" firması` sit under the same
 * header of the same sheet — and the model records which it is beside the name
 * rather than in two tables, because a wrong guess would hide the record
 * (`registry-right-holder.prisma`).
 *
 * The rule is the legal form, which Azerbaijani names one of explicitly: a firm
 * says `MMC`, `ASC`, `firması`, `müəssisəsi`; a person ends in `oğlu` or
 * `qızı`, the patronymic every identity document carries. Where a row says
 * neither the answer is `Individual`, because these registers are overwhelmingly
 * people — and being told a firm is a person costs an inspector one glance,
 * while being told a person is a firm costs them the record.
 */

/** Legal forms and the words for an organisation, as the sources write them. */
const ENTITY = [
  'mmc', 'asc', 'qsc', 'msc', 'ooo', 'ltd', 'llc', 'a.s.',
  'firmasi', 'firma', 'sirketi', 'sirket', 'muessisesi', 'muessise',
  'kombinati', 'zavodu', 'fabriki', 'universiteti', 'institutu',
  'kollektiv', 'ittifaqi', 'cemiyyeti', 'birliyi', 'idaresi', 'nazirliyi',
  'komitesi', 'departamenti', 'merkezi', 'ikf', 'ixmim', 'mktb', 'nez',
]; // prettier-ignore

/** The patronymic. Nothing else in these columns ends this way. */
const PERSON = ['oglu', 'qizi', 'ogli', 'kizi'];

export type HolderKind = 'Individual' | 'LegalEntity';

export function kindOfHolder(name: string): HolderKind {
  const folded = fold(name);

  // The patronymic first: `Azərtel ... A.S. Şirkəti` and `Məmmədov Kənan Əli
  // oğlu (Dövlət)` both carry an organisation word, and only one of them is a
  // firm. A name that states a patronymic has stated it is a person's.
  if (PERSON.some(word => folded.includes(word))) return 'Individual';
  // A quoted name is a trade name — `"Caspian Petrol-1"`, `"ADEC"`.
  if (/["«»“”']/u.test(name)) return 'LegalEntity';
  if (ENTITY.some(word => folded.includes(word))) return 'LegalEntity';

  return 'Individual';
}

function fold(value: string): string {
  return value
    .toLowerCase()
    .replaceAll('ə', 'e')
    .replaceAll('ğ', 'g')
    .replaceAll('ı', 'i')
    .replaceAll('ö', 'o')
    .replaceAll('ş', 's')
    .replaceAll('ü', 'u')
    .replaceAll('ç', 'c')
    .normalize('NFD')
    .replaceAll(/[̀-ͯ]/g, '');
}
