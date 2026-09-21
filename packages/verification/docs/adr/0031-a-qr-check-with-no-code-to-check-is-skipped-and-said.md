# A QR check with no code to check is skipped, and the report says so

Date: 2026-09-17. Status: accepted.

Builds on [ADR-0025](./0025-the-required-set-is-the-provision-of-article-8-the-case-falls-under.md),
which declared where each paper is confirmed and reported a paper only read as
`IntegrationNotConnected`.

## Context

The customer's acceptance contract lists, among the checkpoints of a title
document, "authenticity verified via QR code". The profile reads a `qr_code`
line off every paper that prints one — the plan-scheme, the register extract,
the technical passport and the Soviet-era titles under Decree 439 — and reads
it as the text printed beside the code, never by decoding the picture. Nothing
was done with that line, and nothing was said when no paper had one: a package
with no code at all read exactly like a package whose code was fine.

The customer decided (COMM-104): where the package carries no document with a
QR code, the step is skipped and the report marks it. It is not a fault of the
applicant. It is "there was nothing to check this with", and it must read
differently from "something is wrong".

## Decision

1. **A new kind, `QrCodeUnavailable`.** Compiled once per report, where no
   document in force had a `qr_code` read off it — whether the package carries
   no paper of a kind that prints one, or carries one whose code went unread.
   It names the papers of the package that could have carried a code, so the
   inspector knows which sheet to look at for one the reader missed. It is
   filed against no document: the finding is about the package having none.

2. **Informational.** It counts for nothing against the package: a report that
   carries only it and other informational lines still reads `OK`. The
   applicant is not answerable for there being nothing to check.

3. **Not `IntegrationNotConnected`.** That kind says a paper was read and not
   confirmed through its source. This one says there was no paper to confirm.
   Folding the two together would let "the step never happened" read as "the
   step happened without a live integration".

4. **Which papers carry a code is the profile's.** `VerificationProfile.qrCarriers`
   is every type whose schema declares `qr_code`. A profile that asks no paper
   for one has no QR check, and the finding is never compiled for it.

5. **Where a code was read, nothing new is said.** No integration decodes or
   follows the code; that paper's source line already says it was read and not
   confirmed.

## Consequences

A Postgres enum value, in its own migration
(`20260917120000_qr_code_unavailable_finding`). The contract enum gains
`QrCodeUnavailable`; a client exhausting `IssueKind` has to name it.

The detail page lists it among the notes. The customer asked for it to be
marked red; a tone that is red and yet counts against nothing does not exist in
the page yet, and is the frontend's to add.

Stored reports are not rewritten. A re-run recompiles them.
