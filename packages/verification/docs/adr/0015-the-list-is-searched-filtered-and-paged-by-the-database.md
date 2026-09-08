# The list is searched, filtered and paged by the database

Date: 2026-09-08. Status: accepted.

## Context

`GET /api/packages` took nothing and answered with every submission the office
had ever accepted, newest first. Three things were missing and one was about to
break.

The list grows by one row per submission and never shrinks. A call that answers
with all of them is a call that gets slower every week, and the browser holding
the answer gets slower with it.

An inspector opening the list is looking for **one** submission — the one on the
desk — or for **a kind** of submission: the ones short of a paper, the ones
whose report found something. Neither question could be put.

The original task also asked for a search by applicant. There are no applicant
accounts and there will be none (COMM-37 cancelled, confirmed on COMM-39): the
user is the inspector and the whole list is theirs. That part of the scope, and
with it the per-role visibility rule, is gone.

## Decision

### One page, always

`ListPackagesRequest` carries `limit` (1..100, default 20) and `offset`
(default 0); `ListPackagesResponse` is `{ items, total, limit, offset }`. There
is no request that means "all of them".

`total` is the count the criteria matched, not the size of the page: a pager
that cannot say how many pages there are is a pager nobody can use. It is taken
in the same transaction as the page, or a submission accepted between the two
queries leaves the screen saying "11 rows" over a page that is one of ten.

Offset and not a keyset cursor. The screen this serves is a filtered list with
page numbers, which is what an offset answers and a cursor does not; the price
is that a submission accepted while the inspector is on page three shifts a row
onto page four. The ordering is `createdAt desc, id desc` — the id settles a
tie, because two packages accepted in the same millisecond otherwise have no
order at all and the database is free to answer them differently on two calls,
which shows one of them twice and the other never. If page-number paging ever
stops being what the screen wants, a keyset cursor over that same pair is the
move.

### Two filters, because there are two questions

`standing` narrows by where the submission stands — what has to happen to it
next (ADR-0014). `reportStatus` narrows by what the run found. They are not one
parameter with seven-plus-three values: a package still being read has no
report at all, and `IssuesFound` on a package since re-opened is a report about
an envelope that has changed. Given together they narrow together.

### The standing filter is derived from the standing rule, not written twice

Nothing stores a standing (ADR-0014), so narrowing by one is a condition over
the three columns it is worked out from. Writing that condition out by hand in
SQL would be a second copy of the derivation — and a second copy is exactly
what ADR-0014 exists to prevent, because the row that leads to a card would
sooner or later appear under a standing the card itself denies.

So the condition comes out of the rule. `PackageStanding#facts` runs
`PackageStanding.of` over the whole fact space — four statuses by four report
values by two archive facts by two approvals — and answers with the
combinations that land on that standing; the register turns those into one
`OR` of `AND`s over `status`, the report and whether the archive was asked.
There is one derivation and the filter is a projection of it. Two specs hold
the inverse to being exact in both directions: every fact it names does produce
the standing, and no fact that produces the standing is left out.

### What a search term matches, stated

A package matches when the term, trimmed and case-insensitively, is

- exactly its id — a whole uuid, because the column is `uuid` and Postgres
  matches no pattern against one, and because that is what an inspector pastes
  out of a link;
- part of the name of a file uploaded to it;
- part of a value the pipeline read off one of its documents — the cadastral
  number, the address, the owner's name.

Nothing else. The counts, the dates and the profile key are the row's
furniture, not what a submission is known by. An empty term is no term at all
rather than a refusal: that is what a cleared search box sends.

### The search does not use `@cadastre/matching-engine`

The task asked for this to be decided rather than assumed. It is decided
against, for three reasons, and the third is the one that would change.

**It answers a different question.** The engine decides whether _two values in
hand_ mean the same thing — `namesAgree`, `addressesAgree`, `areasAgree`. A
search asks which of N rows a term could mean, and the answer has to be a
condition the database evaluates, because the answer is then paged and counted.
Using the engine means loading every submission to fold it in memory, which is
the thing paging exists to avoid.

**This context may not import it.** `.oxlintrc.json` allows a `type:context`
package only `@cadastre/api-contracts`, `@cadastre/shared` and the two
technical adapters (ADR-0006). Reaching past that is either a mistake or an
ADR, never a lint-disable — and there is no argument for widening the boundary
to get a comparison that would not be used the way it is written anyway.

**And what it would have been for is gone.** The engine was named in the task
because the search was to be by applicant name, where "Elçin" and "ELÇİN" and
"Елчин" are one person. There are no applicants.

The cost is real and is stated here so the next reader does not rediscover it:
case is ignored, letters are **not** folded, so `Elçin` and `Elcin` are two
terms. When that starts to matter — a search over the extracted values in
earnest — the move is **not** to import the engine into the context. It is
either Postgres's own `unaccent`, or promoting `fold` out of the engine into
`@cadastre/shared`, which every side may depend on, and keeping one folded
column beside each searchable value so the predicate stays in SQL.

## Consequences

`PackagesApi.findMany` takes a request and answers with an envelope: a breaking
change to the published contract, taken now while there is one caller.
`apps/web` reads `.items` and asks for nothing, so it gets the newest twenty;
the screen that puts a search box, the two filters and a pager over this is
frontend work and is not in this change.

No migration: the search and both filters run over columns that already exist.
`ILIKE '%term%'` over `extracted_fields.value` is a sequential scan, which is
the right shape at this size and the wrong one at a hundred thousand
submissions. The move then is a trigram index — `pg_trgm` with a GIN index on
the two searched columns — and it can be added without the contract moving.
