import type { ProfileDto } from "@cadastre/contracts";

import type { ProfileView } from "../../application/read-models/index.js";

export function toProfileDto(view: ProfileView): ProfileDto {
  return {
    key: view.key,
    documentTypes: [...view.documentTypes],
  };
}
