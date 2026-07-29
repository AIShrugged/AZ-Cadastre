import { Controller, Get } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import type { ProfileDto } from "@cadastre/contracts";

import { ListProfilesQuery } from "../../application/use-cases/index.js";
import { toProfileDto } from "./profile.presenter.js";

@Controller("profiles")
export class ProfilesController {
  constructor(private readonly queries: QueryBus) {}

  @Get()
  async list(): Promise<ProfileDto[]> {
    const profiles = await this.queries.execute(new ListProfilesQuery());

    return profiles.map(toProfileDto);
  }
}
