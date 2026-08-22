/*
 * Loaded before any spec, so that reflect-metadata is in place before the first
 * decorated class is defined.
 *
 * It is not strictly required today — every integration spec reaches @nestjs/*
 * through the harness, and Nest imports reflect-metadata itself — but that is an
 * accident of import order, not a guarantee. TypeScript's emitted `__metadata`
 * helper checks `typeof Reflect.metadata === 'function'` and SILENTLY does
 * nothing when it is not there yet: a spec that imports a decorated class before
 * anything pulls Nest would leave that class with no `design:paramtypes`, and
 * the container would inject `undefined` without a word. One line here makes the
 * order irrelevant.
 */
import 'reflect-metadata';
