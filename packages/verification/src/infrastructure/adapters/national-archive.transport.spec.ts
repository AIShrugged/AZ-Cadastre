import dns from 'node:dns';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fetchFromTheArchive,
  ipv4OnlyAgent,
} from './national-archive.transport.js';

/*
 * The failure this exists for: the resolver gives up on a question nobody
 * answers, and `fetch` reports it as a `TypeError` with the errno underneath
 * (COMM-144).
 */
function resolverGaveUp(): TypeError {
  return new TypeError('fetch failed', {
    cause: Object.assign(
      new Error('getaddrinfo EAI_AGAIN api.esd.milliarxiv.gov.az'),
      { code: 'EAI_AGAIN' },
    ),
  });
}

async function listening(): Promise<Server> {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end('{"signatureValidity":true}');
  });

  await new Promise<void>(resolve => {
    server.listen(0, '127.0.0.1', resolve);
  });

  return server;
}

describe('fetchFromTheArchive', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /*
   * The bug itself. The archive's zone has no AAAA records and its servers
   * answer an AAAA question with silence, so a resolution that asks for both
   * families dies on the resolver's own timeout and the QR check never happens
   * (COMM-144). Watched at the socket's own `lookup`, which is where the
   * families are asked for.
   */
  // The one test here that opens a real socket, so it is given room: a busy
  // machine running the whole set at once is not the archive being slow.
  it(
    'asks DNS for A records and nothing else',
    { timeout: 30_000 },
    async () => {
      const server = await listening();
      const { port } = server.address() as AddressInfo;
      const asked: { host: string; family: unknown }[] = [];
      const dispatcher = ipv4OnlyAgent({
        lookup: (
          host: string,
          options: dns.LookupOneOptions,
          done: (...answer: unknown[]) => void,
        ) => {
          asked.push({ host, family: options.family });
          dns.lookup(host, options, done);
        },
      });

      try {
        const response = await fetchFromTheArchive(
          `http://localhost:${String(port)}/v1/signature-info/verifyQr`,
          {
            headers: { accept: 'application/json' },
            timeoutMs: 2000,
            dispatcher,
          },
        );

        expect(response.status).toBe(200);
        expect(asked).toEqual([{ host: 'localhost', family: 4 }]);
      } finally {
        await dispatcher.close();
        server.close();
      }
    },
  );

  it('asks once more when the wire fails, and answers from the second', async () => {
    const fetching = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(resolverGaveUp())
      .mockResolvedValueOnce(Response.json({ signatureValidity: true }));
    vi.stubGlobal('fetch', fetching);

    const response = await fetchFromTheArchive('https://archive.test/q', {
      headers: {},
      timeoutMs: 1000,
    });

    expect(response.status).toBe(200);
    expect(fetching).toHaveBeenCalledTimes(2);
  });

  it('asks twice and no more', async () => {
    const fetching = vi.fn<typeof fetch>().mockRejectedValue(resolverGaveUp());
    vi.stubGlobal('fetch', fetching);

    await expect(
      fetchFromTheArchive('https://archive.test/q', {
        headers: {},
        timeoutMs: 1000,
      }),
    ).rejects.toThrow('fetch failed');
    expect(fetching).toHaveBeenCalledTimes(2);
  });

  /*
   * A timeout means the service was reached and is slow. Asking again doubles
   * the wait for every package behind this one to buy the answer the first
   * attempt was already waiting for.
   */
  it('does not ask again after a timeout', async () => {
    const fetching = vi
      .fn<typeof fetch>()
      .mockRejectedValue(
        new DOMException('The operation was aborted', 'TimeoutError'),
      );
    vi.stubGlobal('fetch', fetching);

    await expect(
      fetchFromTheArchive('https://archive.test/q', {
        headers: {},
        timeoutMs: 1000,
      }),
    ).rejects.toThrow('aborted');
    expect(fetching).toHaveBeenCalledTimes(1);
  });

  // A refusal is an answer, and the adapter is the one that decides what it
  // means. Asking again would only get the same refusal.
  it('does not ask again when the service answered', async () => {
    const fetching = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('no', { status: 503 }));
    vi.stubGlobal('fetch', fetching);

    const response = await fetchFromTheArchive('https://archive.test/q', {
      headers: {},
      timeoutMs: 1000,
    });

    expect(response.status).toBe(503);
    expect(fetching).toHaveBeenCalledTimes(1);
  });
});
