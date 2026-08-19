import { Controller, Get } from "@nestjs/common";
import type { ProfileDto } from "@cadastre/api-contracts/verification";

import { VerificationClientPort } from "../../../application/ports/index.js";

@Controller("profiles")
export class ProfilesController {
  constructor(private readonly verification: VerificationClientPort) {}

  @Get()
  async list(): Promise<ProfileDto[]> {
    return this.verification.profiles.list();
  }
}
