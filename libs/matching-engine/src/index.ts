/**
 * The comparison rules, as pure functions. No framework, no I/O and no
 * dependencies: the stand-in registry answers with them today and a real one
 * answers with the same source tomorrow, which is the only way the two can be
 * held against each other (ADR-0009).
 */
export {
  addressKey,
  addressesAgree,
  normaliseAddress,
  parseAddress,
  type ParsedAddress,
} from './address.js';
export { areasAgree, parseArea } from './area.js';
export { namesAgree } from './name.js';
export { referencesAgree } from './reference.js';
export {
  digitsOf,
  fold,
  fromLegacyCyrillic,
  isCyrillic,
  stripInitials,
  tokenise,
} from './text.js';
