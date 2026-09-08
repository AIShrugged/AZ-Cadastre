# The summary is four tallies over one period, taken at one instant

Date: 2026-09-08. Status: accepted.

## Context

The inspector had the list of submissions and one submission at a time, and no
way to ask anything about all of them. The task (COMM-49, under COMM-36 §8) asked
for "statistics and summary information" and said nothing about what a summary
should answer. There is no second audience to design for: there is no
authentication, so whoever opened the application is the inspector (ADR-0015).

So the questions had to be decided rather than assumed, and decided out of what
the system actually knows rather than out of what dashboards usually show. Every
number below is already in the database — the state of a package, the outcome of
its report, its findings, what the register answered. Nothing new is recorded to
produce them.

## Decision

### Four questions, and they are these four

1. **How much work is in the machine.** Submissions of the period by
   `PackageStatus`: waiting, being read, read, broken down. `Failed` matters
   more than the other three together — it is the only one no amount of waiting
   resolves, because our machinery stopped rather than the papers being short of
   something.
2. **What the runs made of them.** By `ReportStatus`: nothing held against them,
   findings held against them, a set of papers that was short.
3. **What goes wrong, and how often.** Findings by `IssueKind`, most frequent
   first. This is the most valuable of the four: what happens often is a problem
   in the process, what happens once is a problem in one envelope.
4. **How the archive answers.** Register checks by `RegistryOutcome`: confirmed,
   differs, incomplete, not found, ambiguous.

Slice 1 is keyed by the pipeline's own states and not by `PackageStanding`. The
standing answers "what has to happen to this submission next", which is the
question the _list_ is read by and is where it is filtered (ADR-0014, ADR-0015).
This slice answers "how much is in the machine", and the two are not the same
question — a summary that answered both with one vocabulary would be answering
neither.

### One operation, one transaction, one instant

`GET /api/packages/overview` answers all four. Not four calls from the client:
numbers taken by separate calls are numbers from separate moments, and a run
that finishes between two of them is counted as under way by one and as reported
on by the next — the screen then shows a summary that does not add up, and the
reader has no way to tell that from a bug in the counting.

Four grouped statements and not one, because they count four different things —
submissions, reports, findings, questions put to the register — and one query
joining all four would multiply every row by every other. They run inside a
single `RepeatableRead` transaction. Under the default isolation each statement
takes its own snapshot, so the four would still be four moments; read-only work
at this level cannot fail with a serialization error in Postgres, so the
guarantee is free.

### Counted by the database

Every count is an aggregate Postgres performs. Nothing reads packages into the
application to fold them: the list of submissions grows with every one the
office takes in and never shrinks, so an implementation that read them would get
slower every week and would fail by degrees rather than loudly — which is the
failure nobody notices until it is a year old.

The unit set holds this structurally rather than by timing it: the Prisma double
the specs run the register against offers `groupBy` and refuses `findMany`, so
an implementation that read rows fails there instead of passing slowly in
production. Measured over a seeded table, the whole answer takes 32 ms at 50,000
submissions and 97 ms at 200,000.

### The period is over when the submission was accepted, for all four slices

One anchor, and deliberately not one per slice. Counting the submissions by when
they arrived and their findings by when the report was compiled would be two
answers about two different sets of packages, and a reader would be adding up
numbers that were never about the same submissions. A re-run recompiles a
report, so anchoring on the report would also move findings from one period to
another after the fact.

`from` is inclusive, `to` exclusive: a month is `2026-08-01 .. 2026-09-01`, two
adjacent periods count every submission once, and none falls in the crack
between them. Either bound may be left out; naming neither is every submission
the office has ever taken in. A period that ends before it starts is a 400 —
answered with zeros it would read as an office that took nothing in.

The one thing the schema needed for this is an index on
`verification_packages.createdAt`: the packages are narrowed by it directly, and
the reports, the findings and the register's answers through a join onto it.

### The two kinds of finding are never one number

Findings held **against** a package and observations stated **for the record**
are counted apart and never summed. That is not this operation's rule — it is
the report's own, the one `VerificationReport` decides `OK` by and the one a
list row's `issuesCount` is tallied under. A package carrying nothing but the
registry's own service sheets, a second extract and a silent register has no
fault in it, and a summary that added the two would announce faults in
submissions that have none. This has gone wrong here once already (TECH_DEBT §5).

For the same reason `NotFound` from the register keeps a number of its own and
is never folded in with `Differs`. The register's coverage is partial and
historical, so its silence about a property is an absence of evidence and not a
disagreement with the papers (ADR-0009); one number over both would report a gap
in the archive as a fault in the submissions.

### Every member of a vocabulary is always present

The three fixed-vocabulary slices come back as a record with a key per member,
at zero where the period held none — `z.record` over the enum, so the contract
itself refuses a partial one. A tile that vanishes on a quiet week is a tile a
reader cannot trust to be there, and "0 failed" is an answer while a missing key
is a question.

The findings slice is an ordered list instead, because there the order _is_ the
answer. Ties keep the order the domain names the kinds in, so a screen that
re-reads this does not shuffle rows that are level with each other. A stored
kind the enumeration no longer names — `Expired`, which the column still carries
— is counted rather than dropped, on the side held against the package: a total
that silently omits rows is a total nobody can check against the reports.

## Consequences

No new table and no accumulator. The summary is derived from rows that already
exist, in the same spirit as `PackageStanding` (ADR-0014): there is nothing to
keep in step and nothing to migrate when the derivation changes. A rollup table
becomes worth its keep when the query stops answering in time — the numbers
above say that is a long way off — and it can be introduced without the contract
moving.

`PackagesApi` gains an operation; nothing existing changes shape, so no consumer
has to move. The screen that puts these four on a page is frontend work and is
not in this change: what it needs is `GET /api/packages/overview?from&to`
answering `PackagesOverviewResponse`.

The period cannot be narrowed by anything else — not by profile, not by
standing, not by a search term. That is deliberate for now: every filter added
here is a filter the four statements have to carry into their joins, and no
question anybody has asked needs one. When one does, it belongs beside the
period rather than as a second operation.
