# An archive that does not answer is a state of its own, and it is asked over IPv4

Date: 2026-09-23. Status: accepted.

Builds on [ADR-0034](./0034-a-qr-code-is-decoded-from-the-symbol-and-resolved-with-whoever-issued-it.md)
and [ADR-0035](./0035-one-paper-is-checked-by-its-qr-code-and-against-the-archives-own-pdf.md),
which gave the QR check its vocabulary of silences, and on
[ADR-0031](./0031-a-qr-check-with-no-code-to-check-is-skipped-and-said.md), which
decided that a step that did not happen is said rather than left blank.

## Context

On the stand, the QR check never ran. Two runs in a row produced no block at
all: no answer, no line saying the archive could not be asked. The stage threw,
`despite` caught it, `archiveQrCheck` stayed `null` — and `null` on the detail
page means "this check does not apply to this paper", so the block is not drawn.
An integration that was down looked exactly like a feature nobody had built. The
customer walked into it twice (COMM-142, COMM-144).

Two separate faults, and the second is the one that mattered.

**The calls died on DNS.** The archive's domains have no AAAA records, and the
authoritative servers of the zone answer an AAAA question with silence instead of
with NODATA. `getaddrinfo` asks for A and AAAA together and fails the whole
resolution on the half that never comes back, so every call died on the
resolver's own five-second timeout — `durationMs ≈ 5018` whatever
`NATIONAL_ARCHIVE_TIMEOUT_MS` was set to. Measured on the stand: 29 of 40
`dns.lookup` calls failed with `EAI_AGAIN`, all of them at 5002–5006 ms, while
`{ family: 4 }` and `dns.resolve4` failed none, and `openrouter.ai` resolved
every time. It reproduces under glibc as well as musl, so it is the zone and not
the container. It passes now and then, when a negative AAAA answer happens to be
cached — which is why a hand-run `curl` in the container sometimes answers 200
and everything looks fine.

Both of the archive's hosts are affected: the service (`api.esd.milliarxiv.gov.az`)
and the presigned download the signed PDF comes from
(`content-veams.milliarxiv.gov.az`).

**And the failure had nowhere to be said.** Even with the resolver fixed, a
network that blinks would put the check back in exactly this position: a paper
with no line on it, which reads as a paper the check has nothing to do with.

## Decision

1. **The archive is asked over IPv4.** Both calls go through one undici
   dispatcher with `connect: { family: 4, autoSelectFamily: false }` —
   `infrastructure/adapters/national-archive.transport.ts`. Local to the archive
   on purpose: a process-wide `dns.setDefaultResultOrder` or a global dispatcher
   would change how every other integration reaches everything, to work around
   one zone the others do not live in.

2. **One more attempt when the wire fails.** A transport failure carries an
   errno; those get a second try with a fresh timeout. Two failures do not: a
   request the caller aborted, and an attempt that ran out its own timeout — a
   timeout means the service was reached and is slow, and asking again doubles
   the wait for every package behind this one to buy the answer the first
   attempt was already waiting for. It is one request per package, so the retry
   costs nothing worth counting, and what it buys is the difference between a
   paper checked and a paper silently not checked.

3. **A new status: `IssuerUnreachable`.** The issuer was asked and the asking
   failed. It is not `NotFound` — nobody looked, so nothing was found or not
   found, and `NotFound` would be a claim about the archive's holdings that no
   search supports. It is not `IssuerNotConnected` either, which is a service
   this system cannot ask at all. It is `isUnanswered`, so it is informational
   like every other absence of evidence and is never held against the package:
   the applicant did not take the archive's DNS down.

4. **The port answers it; it does not throw.** `NationalArchivePort` gains an
   `Unreachable` outcome. An exception here leaves no check on the paper, and a
   missing check is invisible — which is the whole bug. A refusal still throws:
   a 4xx is this system being wrong about the contract, and a deployment bug
   that shows up on the report as "the archive did not answer" is a deployment
   bug nobody goes looking for.

5. **A paper nobody answered about is asked again on the next run.** Every other
   status is an answer and is not re-asked; this one is the absence of one, and
   an archive that was down an hour ago is the single thing in this check that
   comes back on its own.

## Consequences

A Postgres enum value in its own migration
(`20260923120000_qr_issuer_unreachable`) and a value on
`ArchiveQrCheckStatusSchema` in the contract: a client exhausting the status has
to name it. Nothing is backfilled — a check that failed this way before now was
never written at all.

**The frontend's maps are exhaustive over the status**, so the page carries the
new one or the build does not compile: a tone (`silent`, like every other
absence), an icon of its own, a label and a sentence in all three languages.
That is the whole of what was done to `apps/web` here — the maps completed and
the dictionary filled, no layout and no new component. How prominently a
down integration should be drawn, and whether a run that ends this way deserves
anything louder than a silent mark, is the frontend's to decide.

`undici` becomes a direct dependency of `@cadastre/verification`. It was already
in the lockfile transitively, and Node's own `fetch` is undici's, so this pins
what was already being used rather than adding a client.

The retry is in the transport and not in the stage, so it covers the metadata
call and the signed-PDF download both, and neither adapter has a retry of its
own to keep in step.
