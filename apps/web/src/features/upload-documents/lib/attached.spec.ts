import { describe, expect, it } from 'vitest';

import type { Attachment } from '../model/types';

import { attachedFiles } from './attached';

function attachment(over: Partial<Attachment>): Attachment {
  return {
    id: 'a',
    name: 'deed.pdf',
    size: 1024,
    kind: 'pdf',
    status: 'ready',
    progress: 100,
    key: 'documents/2026/deed.pdf',
    contentType: 'application/pdf',
    ...over,
  };
}

describe('attachedFiles', () => {
  it('sends the storage key and the type the file was stored as', () => {
    expect(attachedFiles([attachment({})])).toEqual([
      {
        originalFilename: 'deed.pdf',
        contentType: 'application/pdf',
        storageKey: 'documents/2026/deed.pdf',
      },
    ]);
  });

  it('leaves out a transfer that has not finished', () => {
    const uploading = attachment({
      id: 'b',
      status: 'uploading',
      progress: 40,
      key: undefined,
      contentType: undefined,
    });
    expect(attachedFiles([uploading])).toEqual([]);
  });

  it('leaves out a file this feature refused outright', () => {
    const refused = attachment({
      id: 'c',
      status: 'error',
      error: 'size',
      key: undefined,
      contentType: undefined,
    });
    expect(attachedFiles([refused])).toEqual([]);
  });

  // A row marked ready with no key is the shape that used to reach the service
  // as `storageKey: undefined` — the transfer resolved, the key did not.
  it('leaves out a ready row that carries no key', () => {
    expect(attachedFiles([attachment({ key: undefined })])).toEqual([]);
    expect(attachedFiles([attachment({ contentType: undefined })])).toEqual([]);
  });

  it('keeps the order the inspector added them in', () => {
    const files = [
      attachment({ id: '1', name: 'first.pdf', key: 'k1' }),
      attachment({ id: '2', status: 'uploading', key: undefined }),
      attachment({ id: '3', name: 'third.png', key: 'k3' }),
    ];
    expect(attachedFiles(files).map(file => file.originalFilename)).toEqual([
      'first.pdf',
      'third.png',
    ]);
  });
});
