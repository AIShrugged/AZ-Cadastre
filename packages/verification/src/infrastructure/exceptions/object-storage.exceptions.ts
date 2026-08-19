import { InfrastructureException } from "@cadastre/shared";

import type { StorageKey } from "../../domain/value-objects/index.js";

export class ObjectBodyMissingException extends InfrastructureException {
  override readonly code = "OBJECT_BODY_MISSING";

  constructor(public readonly key: StorageKey) {
    super(`Object "${key.value}" has no body`);
  }
}
