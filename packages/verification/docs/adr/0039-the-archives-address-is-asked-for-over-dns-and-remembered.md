# The archive's address is asked for over DNS, and the last one that answered is remembered

Date: 2026-09-23. Status: accepted.

Extends [ADR-0037](./0037-an-archive-that-does-not-answer-is-a-state-of-its-own.md),
which pinned the archive's calls to IPv4 and gave "nobody answered" a state of
its own.

## Context

ADR-0037 went to production and the check still did not run. The line it
produced is the handled one — the stage no longer throws, the paper now carries
`IssuerUnreachable` and the report a sentence — but underneath it the failure is
the same errno:

```
TypeError: fetch failed
caused by: Error: getaddrinfo EAI_AGAIN api.esd.milliarxiv.gov.az
```

Asking for one family was necessary and not sufficient. `EAI_AGAIN` on an A-only
question is the resolver itself failing or timing out, not the AAAA question
hanging — the archive's zone is served by nameservers that go quiet under load,
and the container's resolver gives up. Two attempts in a row landed on it.

The one thing that is stable in all of this is the answer: the archive's hosts
sit on the same addresses from one day to the next. It was being thrown away
after every request and asked for again.

## Decision

1. **The A record is asked for over DNS directly** — `dns.resolve4`, which goes
   to the nameservers through c-ares and around `getaddrinfo` and the C
   library's resolver, which is the part that returns `EAI_AGAIN`. The socket
   for the archive is given this as its `lookup`; nothing else in the process is
   affected.

2. **An address that answered is kept for five minutes** and used without
   asking again. Short on purpose: the presigned download host is the archive's
   to move, and a run an hour later must follow it.

3. **When nobody answers, the last address that did is used** — up to a day
   after it was confirmed. This is the decision worth arguing about, and the
   argument is that the alternative is worse: the choice is not between a fresh
   address and a stale one, it is between an address the archive gave us this
   morning and a paper nobody checked. A day is the outer bound, after which the
   resolution fails and the paper is `IssuerUnreachable` as ADR-0037 has it.

4. **The system's own resolution is the fallback**, for a deployment whose
   addresses do not come out of public DNS at all — a hosts file, an operator's
   override, a sidecar. A host DNS holds no A record for still resolves.

## Consequences

The failure line now carries `durationMs`, because the first one in production
could not say whether it had waited five seconds on a resolver or failed
instantly without leaving the machine, and that is the first question anybody
asks of it.

No new dependency and no new configuration. The memory is per process and dies
with it, so a restart is a clean slate — which is the right default for a cache
nobody can invalidate.

If the archive ever does move a host while its nameservers are down, this will
send one request to the old address and get a refusal or a timeout; that comes
back as `IssuerUnreachable`, the same answer the paper would have had anyway.
