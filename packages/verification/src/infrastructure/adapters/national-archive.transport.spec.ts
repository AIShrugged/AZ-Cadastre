import dns from 'node:dns';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fetchFromTheArchive,
  ipv4Lookup,
  ipv4OnlyAgent,
  type Resolver,
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

// The lookup answers a socket, so a spec that wants one address asks it the
// way a socket does.
async function resolved(
  lookup: ReturnType<typeof ipv4Lookup>,
  hostname: string,
): Promise<[unknown, unknown]> {
  return new Promise((resolve, reject) => {
    lookup(hostname, {}, (error, address, family) => {
      if (error) reject(error);
      else resolve([address, family]);
    });
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

/*
 * The archive's name resolution (COMM-144, second round).
 *
 * Asking for one family was not enough: production still reported `EAI_AGAIN`,
 * which is the resolver itself failing rather than the AAAA question hanging.
 * So the A record is asked for over DNS directly and the address that answered
 * is remembered — a paper checked against the address the archive gave this
 * morning beats a paper nobody looked at.
 */
describe('resolving the archive', () => {
  // One address, asked for once: a second question inside the freshness window
  // is a question nobody needed the answer to.
  it('answers from the A record, and does not ask again straight away', async () => {
    const resolver = {
      a: vi.fn<Resolver['a']>().mockResolvedValue(['185.129.61.10']),
      system: vi.fn<Resolver['system']>(),
    };
    const lookup = ipv4Lookup(resolver);

    expect(await resolved(lookup, 'api.esd.milliarxiv.gov.az')).toEqual([
      '185.129.61.10',
      4,
    ]);
    expect(await resolved(lookup, 'api.esd.milliarxiv.gov.az')).toEqual([
      '185.129.61.10',
      4,
    ]);
    expect(resolver.a).toHaveBeenCalledTimes(1);
    expect(resolver.system).not.toHaveBeenCalled();
  });

  // The socket asks in two shapes depending on how it was configured, and an
  // answer in the wrong one is a connection that never happens.
  it('answers in the shape the socket asked in', async () => {
    const lookup = ipv4Lookup({
      a: async () => ['185.129.61.10'],
      system: async () => '',
    });

    const all = await new Promise(resolve => {
      lookup('api.esd.milliarxiv.gov.az', { all: true }, (_error, answer) =>
        resolve(answer),
      );
    });

    expect(all).toEqual([{ address: '185.129.61.10', family: 4 }]);
  });

  /*
   * The failure production actually reported. The resolver stops answering,
   * and the address it gave earlier is used rather than the run losing the
   * check — the archive's own records are what would say that address is
   * stale, and they are exactly what cannot be asked at that moment.
   */
  it('uses the address that answered last when nobody answers now', async () => {
    const resolver = {
      a: vi
        .fn<Resolver['a']>()
        .mockResolvedValueOnce(['185.129.61.10'])
        .mockRejectedValue(
          Object.assign(new Error('queryA EAI_AGAIN'), { code: 'EAI_AGAIN' }),
        ),
      system: vi.fn<Resolver['system']>(),
    };
    let clock = 0;
    const lookup = ipv4Lookup(resolver, () => clock);

    await resolved(lookup, 'api.esd.milliarxiv.gov.az');
    clock = 10 * 60_000;

    expect(await resolved(lookup, 'api.esd.milliarxiv.gov.az')).toEqual([
      '185.129.61.10',
      4,
    ]);
    expect(resolver.a).toHaveBeenCalledTimes(2);
  });

  // A day later it is not an address any more, and answering with it would be
  // asking the archive's question of whoever holds that address now.
  it('gives up on an address nobody has confirmed for a day', async () => {
    const resolver = {
      a: vi
        .fn<Resolver['a']>()
        .mockResolvedValueOnce(['185.129.61.10'])
        .mockRejectedValue(
          Object.assign(new Error('queryA EAI_AGAIN'), { code: 'EAI_AGAIN' }),
        ),
      system: vi.fn<Resolver['system']>(),
    };
    let clock = 0;
    const lookup = ipv4Lookup(resolver, () => clock);

    await resolved(lookup, 'api.esd.milliarxiv.gov.az');
    clock = 25 * 60 * 60_000;

    await expect(resolved(lookup, 'api.esd.milliarxiv.gov.az')).rejects.toThrow(
      'EAI_AGAIN',
    );
  });

  /*
   * A deployment whose addresses do not come out of DNS at all — a hosts file,
   * an operator's override, a sidecar — resolves through the system and
   * nothing here may stand in its way.
   */
  it('falls back to the system where DNS holds no record', async () => {
    const lookup = ipv4Lookup({
      a: async () => [],
      system: async () => '10.0.0.8',
    });

    expect(await resolved(lookup, 'api.esd.milliarxiv.gov.az')).toEqual([
      '10.0.0.8',
      4,
    ]);
  });
});

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

  /*
   * The default pool, end to end, with nothing swapped out: its own lookup, its
   * own connect options, a real socket. `localhost` has no A record in DNS, so
   * this is also the fallback to the system's own resolution being exercised
   * the way a deployment with a hosts file would exercise it.
   */
  it(
    'reaches a service through the pool it builds for itself',
    { timeout: 30_000 },
    async () => {
      const server = await listening();
      const { port } = server.address() as AddressInfo;

      try {
        const response = await fetchFromTheArchive(
          `http://localhost:${String(port)}/v1/signature-info/verifyQr`,
          { headers: { accept: 'application/json' }, timeoutMs: 20_000 },
        );

        expect(response.status).toBe(200);
      } finally {
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
