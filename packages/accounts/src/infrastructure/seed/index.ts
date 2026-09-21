import type { Provider } from '@nestjs/common';

import { AccountSeeder } from './account-seeder.js';

export { AccountSeeder } from './account-seeder.js';

export const ACCOUNTS_SEED: Provider[] = [AccountSeeder];
