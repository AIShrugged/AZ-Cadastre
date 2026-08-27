import type { ProfileDto } from '../dto/index.js';

export interface ProfilesApi {
  findMany(): Promise<ProfileDto[]>;
}
