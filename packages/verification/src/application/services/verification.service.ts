import { Injectable } from "@nestjs/common";

import { VerificationApiPort } from "../ports/inbound/index.js";
import { DocumentsService } from "./documents.service.js";
import { PackagesService } from "./packages.service.js";
import { ProfilesService } from "./profiles.service.js";

/**
 * The only class in the context that knows the whole API surface. It holds the
 * per-area services and delegates; everything else in here knows one area.
 */
@Injectable()
export class VerificationService extends VerificationApiPort {
  constructor(
    readonly packages: PackagesService,
    readonly documents: DocumentsService,
    readonly profiles: ProfilesService,
  ) {
    super();
  }
}
