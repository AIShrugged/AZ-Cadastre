import { Controller, Get, Query } from '@nestjs/common';

import {
  SuggestProfileRequestSchema,
  type ProfileDto,
  type ProfileSuggestionDto,
  type SuggestProfileRequest,
} from '@cadastre/api-contracts/verification';

import { VerificationClientPort } from '../../../application/ports/index.js';

@Controller('profiles')
export class ProfilesController {
  constructor(private readonly verification: VerificationClientPort) {}

  @Get()
  async list(): Promise<ProfileDto[]> {
    return this.verification.profiles.findMany();
  }

  /*
   * Which profile the figures declared at intake point at, and why.
   *
   * A GET on the profiles rather than a step of the submission: nothing is
   * created, the intake screen asks it while the operator is still typing, and
   * asking it changes nothing about the package that follows. Its answer is a
   * recommendation — `POST /packages` takes the operator's own choice of
   * profile whatever this said.
   *
   * The query string is the whole of what it takes, and the schema is what says
   * so: a year outside the window the engine reads one in is a 400 from here,
   * never a call into the context. Asking with neither figure is a perfectly
   * good question and is answered with no profile and the reason why.
   */
  @Get('suggestion')
  async suggest(
    @Query({ schema: SuggestProfileRequestSchema })
    query: SuggestProfileRequest,
  ): Promise<ProfileSuggestionDto> {
    return this.verification.profiles.suggest(query);
  }
}
