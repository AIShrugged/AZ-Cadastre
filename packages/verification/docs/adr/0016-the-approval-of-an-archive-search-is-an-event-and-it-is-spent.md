# The approval of an archive search is an event, and it is spent when the search is made again

Date: 2026-09-08. Status: accepted.

## Context

The register stage has worked since ADR-0009: the archive register is asked what
it holds about the property, and its answer — `Confirmed`, `Differs`,
`Incomplete`, `NotFound`, `Ambiguous`, plus whether the archive has the original
of each paper (ADR-0010) — is kept whole in `registry_checks` so the report can
be compiled from it afresh every time.

What was missing is the other half: **a person reading those answers and saying
what they mean for the submission.** The PRD put it outside the MVP in as many
words — _"Human review workflows and notifications are intentionally left
outside the MVP"_ — so there was no approval, no comment and no summary, and
ADR-0014 had to write `archiveSearchApproved: false` at both places the standing
is worked out, with a comment saying why. Every clean cadastre package sat at
`AwaitingArchiveApproval` because nobody could in fact approve anything.

Three things about the shape of this system decide the rest of it.

**There are no accounts.** Authentication was cancelled; access is open and the
user is an inspector. So there is nothing to read an author off.

**The register is outside the system.** It states facts about its own fonds and
never passes judgement on an application (`CONTEXT-MAP.md`, ADR-0009). An
approval is a decision **about the submission**, and mixing the two would put
words in the register's mouth.

**The checks are replayed.** A file arriving discards the register's answers and
the package is read again (ADR-0013), and a re-run replaces each check's answer
in place. So whatever is approved can stop being what the package holds.

## Decision

### An approval is a row of its own, and an event rather than a field

`archive_search_approvals`, one row per approval, with the answers it covered in
`archive_search_approval_checks`. Not a column on the package: what matters is
that a person signed, when, and that what they signed for was **that** state of
the archive search — none of which a boolean can carry.

### It is spent when the archive search is made again

`supersededAt` is filled in and the row stays on file. Nothing is deleted and
nothing is overwritten: the record says what was approved, when, and when it
stopped counting. **An approval in force is one with `supersededAt` null, and a
package has at most one.** That single fact is the whole of what the standing
reads, on both sides — the aggregate off its own state, the read adapter off the
row it is already tallying, through the one derivation ADR-0014 established.

The aggregate spends it, in exactly two places, because there are exactly two
ways the archive search changes: a fresh answer from the register
(`recordRegistryCheck`) and a file arriving, which discards the answers outright
(`addFiles`). Both call one private method, so a third path added later has one
obvious thing to call — and a test holds the rule that a re-run leaves the
package unapproved.

The alternative was to compare the approval against the checks on every read: a
digest of the answers, stored with the approval and re-derived when anything
asks. It says the same thing and it cannot be forgotten — but the list screen
filters by standing in SQL (ADR-0015), and a digest is not something a `WHERE`
clause can compute. That would have forced a second implementation of the
derivation, which is precisely what ADR-0014 exists to prevent. A remembered
call in one aggregate is a smaller risk than two rules that must agree.

### The summary is required; the comment is not

Both are the person's own words, and they answer different questions. The
**summary** is what the archive search means for the submission as a whole — the
line the next reader opens the approval for. The **comment** is a remark on the
act of approving: a reservation, or why this was signed for despite something.

The summary is required because of what this approval is not. It names nobody,
so an approval carrying only a timestamp would say that a search was signed for
and nothing whatever about what signing it meant. One required line of human
judgement is what keeps it from being a button press.

The comment is optional for the mirror-image reason. A second box that must be
filled in beside the summary is a box that gets "ok" typed into it, and a record
full of "ok" reads like deliberation without being any. Blank is no comment, not
an empty one — that is what an untouched box sends.

Both are capped at 2000 characters. Neither is the report.

### An approval in force is refused a second one

`ARCHIVE_SEARCH_ALREADY_APPROVED`. An approval is a fact, not a draft: the way
it ends is that the register is asked again. Correcting the wording of one is a
different act — an amendment — and it is not in this change. If it is wanted, it
is a second row that says what it amends, never an update of the first.

Approval is also refused where the run has not finished
(`ARCHIVE_SEARCH_NOT_SETTLED`) — the answers are still the run's to replace —
and where the register was never asked (`ARCHIVE_SEARCH_NOT_ASKED`): a profile
that asks it nothing, and a package whose address no sheet stated, leave no
search to sign for, and settling a submission on the strength of a question
nobody put is worse than leaving it open. All three are 409s: the request was
well formed, the package is in no state for it.

### There is no author, and no substitute for one

No column, no field on the request, no free-text name. There is nothing to read
one off, and a box to type one into would manufacture the appearance of
accountability rather than record it. When accounts arrive the author is one
more column here and one more field on the DTO, and nothing else about this
changes.

### Only an administrator may approve — and nothing enforces it

That is the rule the task states, and it is written down here unenforced. There
is no authentication, so the endpoint cannot tell an administrator from anybody
else, and any check it could make today — a name in the body, a header the
caller sets — would be a lock with the key taped to it, worse than none because
it would read as one. `POST /api/packages/:id/archive-search-approval` is the
one place a guard attaches when accounts exist; the controller says so.

## Consequences

- `PackageStanding.AWAITING_ARCHIVE_APPROVAL` starts telling the truth, and
  `Cleared` becomes reachable for a package whose archive search was approved —
  which is what ADR-0014 said would happen when this landed.
- `PackageDetailDto` gains `archiveSearchApprovals`, newest first and including
  the spent ones. A spent approval is exactly what a reader has to be able to
  see; hiding it would be the silence this decision exists to prevent.
- The summary query counts one more relation, filtered to the approvals in
  force. The standing filter (ADR-0015) gains one more relation condition per
  branch — and because the two archive facts do not vary independently
  (`Cleared` is every combination except a search made and not approved), they
  are enumerated as pairs off `PackageStanding.facts` rather than as a product.
- Nothing in the pipeline changes. No stage writes an approval, and a package
  re-opened by a file arriving loses the one it had without anybody resetting
  anything.
- A package can hold several approvals over its life — one per archive search it
  has had. That is the history, and it is the point.
