/*
 * First, before anything imports a decorated class.
 *
 * TypeScript's emitted `__metadata` helper checks
 * `typeof Reflect.metadata === 'function'` and SILENTLY does nothing when it is
 * not. A class defined before reflect-metadata loads therefore carries no
 * `design:paramtypes` at all, and Nest injects `undefined` for every constructor
 * parameter that has no explicit `@Inject`. Nothing in the container's output
 * says so: the handler builds, and the dependency is undefined at call time.
 *
 * The application gets this for free — `main.ts` is the first thing loaded and
 * pulls @nestjs/core, which imports reflect-metadata. A test file does not.
 */
import 'reflect-metadata';
