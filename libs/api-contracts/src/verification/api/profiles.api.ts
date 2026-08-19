import type { ProfileDto } from "../dto/index.js";

export interface ProfilesApi {
  list(): Promise<ProfileDto[]>;
}
