import type { Provider } from '@nestjs/common';

import { PasswordHasher } from '../../application/ports/outbound/index.js';

import { Argon2PasswordHasher } from './argon2-password-hasher.adapter.js';

export { Argon2PasswordHasher } from './argon2-password-hasher.adapter.js';

export const ACCOUNTS_SECURITY: Provider[] = [
  { provide: PasswordHasher, useClass: Argon2PasswordHasher },
];
