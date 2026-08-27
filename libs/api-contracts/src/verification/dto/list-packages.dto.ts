import { z } from 'zod';

import { PackageDtoSchema } from './package.dto.js';

export const ListPackagesResponseSchema = z.array(PackageDtoSchema);
export type ListPackagesResponse = z.infer<typeof ListPackagesResponseSchema>;
