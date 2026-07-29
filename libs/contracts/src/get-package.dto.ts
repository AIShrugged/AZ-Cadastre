import { z } from "zod";

import { PackageDetailDtoSchema } from "./package.dto.js";

export const GetPackageResponseSchema = PackageDetailDtoSchema;
export type GetPackageResponse = z.infer<typeof GetPackageResponseSchema>;
