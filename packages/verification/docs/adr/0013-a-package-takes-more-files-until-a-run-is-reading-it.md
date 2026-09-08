# A package takes more files until a run is reading it, and a file that arrives discards the report

Date: 2026-09-08. Status: accepted.

## Context

Files were named once, at submission. `PackagesApi` was `create`, `findMany`,
`findOne`, and a package's envelope was fixed from the moment the inspector
pressed send.

The report is what makes that untenable. Its commonest outcome is
`IncompletePackage`: a required document is missing, and the report says which
one. The inspector then goes and gets it — and had nowhere to put it. The only
way to act on the system's own finding was to submit the whole package again
under a new id, which loses the pages already read, pays the reader for them a
second time, and leaves two rows where the inspector has one submission.

Two questions had to be answered together, because the answer to either alone is
incoherent.

**In which states may a file arrive?** and **what happens to a report the
package already has?**

## Decision

### A package takes more files in every state but `Processing`

Named in the contract as `PackageStatusTakingFilesSchema`, so a caller can tell
before it asks and a button is enabled off the answer rather than off a guess.

`Processing` is the one refusal. The run reads the list of files it loaded when
it started and walks it stage by stage; a file added halfway through would reach
no stage of it, and the report that run is about to compile would describe a
package that is no longer the one on file. The refusal says that, and says when
to come back — `PACKAGE_NOT_TAKING_FILES`, 409. A refusal a caller cannot act on
is a refusal that gets retried.

`Pending` and `Failed` take files for the obvious reason: nothing has been
concluded about the package yet. `Completed` takes them too, and that is the
case the operation exists for — refusing there would have left the feature
answering none of the situations that asked for it, because `Pending` is a
window a few milliseconds wide and `Failed` means our own machinery broke.

### A file that arrives discards the report, and the package is verified afresh

Not "the report goes stale". A report nobody may act on is not a report, and a
staleness flag is a third state every reader has to remember to check — the
first one that forgets shows an inspector a finding about an envelope that has
since changed.

Discarded with it: the cross-document checks and the archive register's answers.
Those were worked out **across** the package. A paper that has just arrived may
be the counterpart a check was waiting for, or one of the originals the archive
was asked about, and the stage that made them skips a check it has already made.
Keeping them would compile the new report half out of answers about the old
envelope.

Kept: everything read off each file **on its own** — its sheets, the text read
off them, the documents carved out of them and what was extracted from those.
Another file arriving does not change what this one says. That line is what
makes the fresh run cheap: every stage already skips work it has done, so the
re-run splits, reads and segments only the file that arrived, and then redoes
the two stages that look at the package as a whole.

The package goes back to `Pending` and raises `FilesAdded`, which the same
handler answers as `PackageSubmitted` — files have arrived, so read the package.

## Consequences

- The write path had to learn to **remove**: a source file is upserted rather
  than created once with its package, a report row is deleted when the aggregate
  holds none, and cross-checks and registry checks the aggregate no longer holds
  are deleted with it. Until now the aggregate only ever grew, and the repository
  had quietly been written as if it always would.
- Adding a file to a reported package costs another run of the two package-wide
  stages, including one call to the archive register. That is the price of a
  report that describes the package in front of it.
- `POST /api/packages/:id/files` answers **200**, not 201: what comes back is the
  package as it now stands. The bytes reached the store before the call, through
  the presign every upload goes through — there is one way to put a file in the
  store, and this is not a second one.
- Nothing here knows who added the file. Ownership, the applicant and the rights
  model are not in this system yet (COMM-37, COMM-38); when they arrive, this
  operation is one of the places that will have to ask.
