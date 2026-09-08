import type { FileInput } from '@cadastre/api-contracts/verification';

import type { Attachment } from '../model/types';

/**
 * The rows that can actually be handed to the service, as the contract wants
 * them. Only a fully-transferred file carries a storage key, and a key is the
 * whole of what a package is told about a file — the bytes went straight to the
 * store and never passed through the service.
 *
 * A row still uploading, or one this feature refused outright, is silently not
 * here: it is on screen with its own state, and a caller that filtered by
 * `status === 'ready'` alone would send a key of `undefined`.
 */
export function attachedFiles(files: readonly Attachment[]): FileInput[] {
  return files.flatMap(file =>
    file.status === 'ready' && file.key && file.contentType
      ? [
          {
            originalFilename: file.name,
            contentType: file.contentType,
            storageKey: file.key,
          },
        ]
      : [],
  );
}
