# Where a submission stands is a third state, and it is derived rather than kept

Date: 2026-09-08. Status: accepted.

## Context

An inspector opens the list to ask one question — what do I have to do with this
submission? — and nothing in the contract answered it.

Two things were published and neither is that question. `PackageStatus` is where
the pipeline got to: `Pending → Processing → Completed | Failed`. `ReportStatus`
is what the run found: `OK`, `IssuesFound`, `IncompletePackage`. A run is never
stopped by what it could not read, so **`Completed` covers a package with a full
set of papers and a package with seven findings alike**, and the two look the
same in a list.

`apps/web` had already noticed, and had written the missing concept for itself:
a local `Disposition` — `in_progress | incomplete | issues | ok | failed` —
worked out in `toViewPackage` from the two fields it did get. One client, one
copy. A second client, or the same client on the summary screen and the detail
screen, is where copies of a rule start to disagree.

`CONTEXT-MAP.md` already forbids exposing either of the two as "status"
unqualified, and adding a third thing called a status would have made that
entry unusable rather than enforcing it.

## Decision

### A third concept, with a name of its own: **Standing**

`PackageStanding` in the domain, `PackageStandingSchema` in the contract,
`standing` on `PackageDto`. Not a status, not a state, not a stage — all three
are taken or about to be, and a fourth word spelled like the first two is how
the next reader ends up unsure which of them a field means. Its row in
`CONTEXT-MAP.md`'s language-conflicts table sits next to the two it must not be
confused with.

Seven values, each naming **what has to happen next** rather than what happened:

| Standing                  | What it says                                                            |
| ------------------------- | ----------------------------------------------------------------------- |
| `Queued`                  | accepted, no run has read it yet                                        |
| `UnderVerification`       | a run is reading it                                                     |
| `Stalled`                 | our own machinery broke down; nothing was concluded about the papers    |
| `ShortOfDocuments`        | a paper the profile requires never arrived — get it and add it          |
| `NeedsInspector`          | the envelope is complete and there are findings for a person to resolve |
| `AwaitingArchiveApproval` | nothing is held against it; the archive search still wants signing off  |
| `Cleared`                 | nothing is held against it and nothing is outstanding                   |

`Stalled` is deliberately apart from the four below it. Those are the engine
having something to say; that one is the engine having failed to say anything,
and an inspector told "no issues" because a provider timed out would be told a
falsehood about somebody's submission.

`Cleared` is not a decision about the registration. This system never makes one
— the inspector does — and the word says only that the submission is waiting on
nobody.

### It is derived, never stored

Read off three things the package already holds: the pipeline's status, the
report's status, and whether the archive register was asked anything at all.
There is no column, no migration, and no row that can fall out of step with the
package it describes. A state somebody has to remember to advance is a state
that is wrong by the second week, and nobody was going to keep this one by hand.

One derivation, in the domain, used by both sides. The aggregate reads it off
its own fields; the read adapter reads it off the row it is already tallying,
through the same function. Two implementations of one rule is exactly how the
register once said 17 findings over a package whose own card said 19
(`TECH_DEBT.md` §5), and that mistake is not worth making twice.

### The order is what is most pressing, not what is most severe

A package that is short of a paper **and** whose archive search wants approving
is `ShortOfDocuments`. The paper will be added, the run will happen again, and
everything the register answered about the old envelope is discarded with the
report (ADR-0013) — so naming the approval now would send a person to do work
that is about to be thrown away.

### The archive approval is an input the system cannot yet produce

`AwaitingArchiveApproval` asks two things: was the register asked, and has a
person approved what it answered. Only the first exists today. The approval, its
comment and its summary are COMM-40, so the second is `false` at both call
sites, each with a comment saying so.

The consequence is deliberate and is not a placeholder: every clean cadastre
package sits at `AwaitingArchiveApproval` rather than `Cleared`, because nobody
has in fact approved its archive search. That is the true answer, and it is the
most useful one the standing gives today — it says the engine is done and a
person is owed. When COMM-40 lands, one boolean starts telling the truth on its
own and `Cleared` becomes reachable for those packages.

"Was the register asked" is read from the checks the package actually holds and
not from what the profile declares. A check whose address no sheet stated was
never put, and holding a submission for the approval of a question nobody asked
would strand it.

## Consequences

- `PackageDto` gains a required field, so every client sees it and the API tests
  parse it. `apps/web` can drop `dispositionOf` and read `dto.standing`; until it
  does, the two live side by side and the contract's is the one to believe. That
  removal is frontend work and is not done here (COMM-43).
- The summary query counts the package's registry checks. One more count on a
  query that already asks for two.
- The standing is not filterable in the database, because it is not in the
  database. A list screen that wants to filter by it (COMM-39) either filters on
  the columns it is derived from or the derivation moves to SQL — and if it
  moves, this ADR is what says the two must not then disagree.
- Nothing in the pipeline changes. No stage writes it, no event carries it, and
  a package re-opened by a file arriving falls back to `Queued` without anybody
  resetting anything (ADR-0013).
