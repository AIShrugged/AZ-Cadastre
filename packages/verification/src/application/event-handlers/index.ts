import type { Provider } from '@nestjs/common';

import { RunVerificationOnSubmissionHandler } from './run-verification-on-submission.handler.js';

export { RunVerificationOnSubmissionHandler } from './run-verification-on-submission.handler.js';

/** Domain events the context reacts to itself, on the in-process bus. */
export const VERIFICATION_EVENT_HANDLERS: Provider[] = [
  RunVerificationOnSubmissionHandler,
];
