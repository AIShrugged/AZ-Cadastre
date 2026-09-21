import type { Provider } from '@nestjs/common';

import {
  AuthenticateAccountHandler,
  GetAccountHandler,
  RegisterAccountHandler,
} from './accounts/index.js';

export * from './accounts/index.js';

/**
 * One operation, one handler. The bus finds them by their decorator; this array
 * only has to get them registered.
 */
export const ACCOUNTS_CQRS_HANDLERS: Provider[] = [
  AuthenticateAccountHandler,
  GetAccountHandler,
  RegisterAccountHandler,
];
