import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';

import { VerificationProfile } from '../../../../domain/value-objects/index.js';
import type { ProfileView } from '../../../read-models/index.js';

import { ListProfilesQuery } from './list-profiles.query.js';

@QueryHandler(ListProfilesQuery)
export class ListProfilesHandler implements IQueryHandler<
  ListProfilesQuery,
  readonly ProfileView[]
> {
  execute(): Promise<readonly ProfileView[]> {
    return Promise.resolve(
      VerificationProfile.all.map(profile => ({
        key: profile.key,
        documentTypes: profile.specs.map(spec => ({
          key: spec.type.value,
          required: spec.isRequired,
          fields: spec.schema.specs.map(field => field.key.value),
        })),
        // What an intake screen offers as the ground a right is claimed on.
        // Always a subset of the types above — the profile refuses to be built
        // otherwise — so a picker built off this can never offer a paper the
        // profile does not read.
        grounds: profile.intake.grounds.map(ground => ground.value),
      })),
    );
  }
}
