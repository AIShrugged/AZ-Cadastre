import { Query } from '@nestjs/cqrs';

import type { ProfileView } from '../../read-models/index.js';

export class ListProfilesQuery extends Query<readonly ProfileView[]> {}
