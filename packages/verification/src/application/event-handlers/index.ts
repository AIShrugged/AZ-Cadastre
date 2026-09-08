import type { Provider } from '@nestjs/common';

import { RunVerificationOnNewFilesHandler } from './run-verification-on-new-files.handler.js';

export { RunVerificationOnNewFilesHandler } from './run-verification-on-new-files.handler.js';

/** Domain events the context reacts to itself, on the in-process bus. */
export const VERIFICATION_EVENT_HANDLERS: Provider[] = [
  RunVerificationOnNewFilesHandler,
];
