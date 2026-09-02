import axios from 'axios';

import { registryBase } from '@/shared/config';

import type { RegistryImportReport } from '../model/types';

/**
 * The register's own import endpoint, under its `api` global prefix. Not a
 * gateway route: `libs/api-gateway` carries `@cadastre/api-contracts`, and this
 * is not in it on purpose (ADR-0011 §1, TECH_DEBT §10).
 */
const IMPORT_PATH = '/api/import/records';

export type ImportHandlers = {
  /** Transfer progress, 0–100. The register reads the workbook after it. */
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
};

/**
 * Send one workbook to the archive register and hand back its report.
 *
 * A bare axios call rather than `shared/api`'s `http`: that instance is the core
 * API's, and this request goes to a different system. The `Content-Type` is left
 * to axios — a boundary written by hand is a multipart body the register cannot
 * split.
 */
export async function importRegistryWorkbook(
  file: File,
  { onProgress, signal }: ImportHandlers = {},
): Promise<RegistryImportReport> {
  const body = new FormData();
  // The field name the register's FileInterceptor is bound to.
  body.append('file', file);

  const { data } = await axios.post<RegistryImportReport>(
    `${registryBase}${IMPORT_PATH}`,
    body,
    {
      signal,
      onUploadProgress: e => {
        const total = e.total ?? file.size;
        if (total > 0) onProgress?.(Math.round((e.loaded / total) * 100));
      },
    },
  );

  return data;
}
