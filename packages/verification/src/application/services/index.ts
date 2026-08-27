import type { Provider } from '@nestjs/common';

import { VerificationApiPort } from '../ports/inbound/index.js';

import { DocumentsService } from './documents.service.js';
import { PackagesService } from './packages.service.js';
import { ProfilesService } from './profiles.service.js';
import { VerificationService } from './verification.service.js';

export { DocumentsService } from './documents.service.js';
export { PackagesService } from './packages.service.js';
export { ProfilesService } from './profiles.service.js';
export { VerificationService } from './verification.service.js';

/**
 * The façade services and the inbound port they add up to. `VerificationService`
 * is bound rather than listed: the port is what the module exports and what the
 * composition root binds the gateway's client port to.
 */
export const VERIFICATION_APPLICATION_SERVICES: Provider[] = [
  DocumentsService,
  PackagesService,
  ProfilesService,
  { provide: VerificationApiPort, useClass: VerificationService },
];
