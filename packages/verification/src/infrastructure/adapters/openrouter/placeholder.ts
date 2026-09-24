// A model asked for a field it cannot find does not always answer with a JSON
// null, however plainly the prompt asks for one: it answers with the word.
// `"null"`, `"n/a"`, `"нет"`, `"yoxdur"` — four characters that mean the same
// absence the null means, and that the adapter used to store as the value of
// the field.
//
// The cost lands on the operator rather than on the pipeline. A parameter whose
// `stated` is the string `"null"` is a parameter the case sheet renders as
// «Заявлено: null — не понято», which reads as a broken calculation; the field
// simply not existing renders as «Не установлено», which is the truth.
//
// So a stand-in word is read as what the model meant by it — nothing — exactly
// as an empty answer already is.
const PLACEHOLDERS = new Set([
  'null',
  'none',
  'n/a',
  'na',
  '-',
  '—',
  'нет',
  'yoxdur',
]);

/**
 * Whether an already-trimmed answer says nothing: empty, or one of the words a
 * model writes when it wants to say it found no value.
 */
export function saysNothing(value: string): boolean {
  return value === '' || PLACEHOLDERS.has(value.toLowerCase());
}
