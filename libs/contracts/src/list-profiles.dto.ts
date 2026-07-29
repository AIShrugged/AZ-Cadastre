import { z } from "zod";

export const ProfileDtoSchema = z.object({
  key: z.string(),
  documentTypes: z.array(z.string()),
});
export type ProfileDto = z.infer<typeof ProfileDtoSchema>;

export const ListProfilesResponseSchema = z.array(ProfileDtoSchema);
export type ListProfilesResponse = z.infer<typeof ListProfilesResponseSchema>;
