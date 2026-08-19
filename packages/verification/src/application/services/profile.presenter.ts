import type { ProfileDto } from '@cadastre/api-contracts/verification';

import type { ProfileView } from '../read-models/index.js';

export function toProfileDto(view: ProfileView): ProfileDto {
  return {
    key: view.key,
    documentTypes: view.documentTypes.map(type => ({
      key: type.key,
      required: type.required,
      fields: [...type.fields],
    })),
  };
}
