import { z } from "zod";

export const ProfileDocumentTypeDtoSchema = z.object({
  key: z.string(),
  // Whether a package under this profile is incomplete without one.
  required: z.boolean(),
});
export type ProfileDocumentTypeDto = z.infer<
  typeof ProfileDocumentTypeDtoSchema
>;

export const ProfileDtoSchema = z.object({
  key: z.string(),
  documentTypes: z.array(ProfileDocumentTypeDtoSchema),
});
export type ProfileDto = z.infer<typeof ProfileDtoSchema>;

export const ListProfilesResponseSchema = z.array(ProfileDtoSchema);
export type ListProfilesResponse = z.infer<typeof ListProfilesResponseSchema>;
