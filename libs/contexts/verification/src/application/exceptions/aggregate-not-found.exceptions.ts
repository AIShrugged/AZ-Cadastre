import { ApplicationException } from "@cadastre/kernel";

import type { PackageId } from "../../domain/value-objects/index.js";

export class PackageNotFoundException extends ApplicationException {
  override readonly code = "PACKAGE_NOT_FOUND";
  override readonly status = 404;

  constructor(public readonly packageId: PackageId) {
    super(`No verification package ${packageId.value}`);
  }
}
