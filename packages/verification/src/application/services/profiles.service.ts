import { Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';

import type {
  ProfileDto,
  ProfilesApi,
} from '@cadastre/api-contracts/verification';

import { ListProfilesQuery } from '../use-cases/index.js';
import { toProfileDto } from '../use-cases/profiles/index.js';

@Injectable()
export class ProfilesService implements ProfilesApi {
  constructor(private readonly queries: QueryBus) {}

  async list(): Promise<ProfileDto[]> {
    const profiles = await this.queries.execute(new ListProfilesQuery());

    return profiles.map(toProfileDto);
  }
}
