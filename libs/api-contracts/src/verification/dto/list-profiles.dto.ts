import { z } from "zod";

export const ProfileDocumentTypeDtoSchema = z.object({
  key: z.string(),
  // Whether a package under this profile is incomplete without one.
  required: z.boolean(),
  // The fields the engine reads off a document of this type, in the order the
  // profile declares them. This is what the type *is* to the system: naming it
  // is the difference between a policy surface listing seven words and one
  // stating what each document is asked to contribute.
  fields: z.array(z.string()),
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
