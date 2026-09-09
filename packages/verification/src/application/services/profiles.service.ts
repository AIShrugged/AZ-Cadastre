import { Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';

import type {
  ProfileDto,
  ProfilesApi,
  ProfileSuggestionDto,
  SuggestProfileRequest,
} from '@cadastre/api-contracts/verification';

import { ListProfilesQuery, SuggestProfileQuery } from '../use-cases/index.js';
import {
  toProfileDto,
  toProfileSuggestionDto,
} from '../use-cases/profiles/index.js';

@Injectable()
export class ProfilesService implements ProfilesApi {
  constructor(private readonly queries: QueryBus) {}

  async findMany(): Promise<ProfileDto[]> {
    const profiles = await this.queries.execute(new ListProfilesQuery());

    return profiles.map(toProfileDto);
  }

  async suggest(request: SuggestProfileRequest): Promise<ProfileSuggestionDto> {
    return toProfileSuggestionDto(
      await this.queries.execute(
        new SuggestProfileQuery(
          request.legalBasis ?? null,
          request.builtYear ?? null,
        ),
      ),
    );
  }
}
