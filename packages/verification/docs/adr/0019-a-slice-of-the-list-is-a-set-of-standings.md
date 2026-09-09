# A slice of the list is a set of standings

Date: 2026-09-09. Status: accepted.

## Context

ADR-0015 gave the list one `standing` parameter taking one value, on the
reading that a slice of the register is a standing. The screen built on it says
otherwise.

The tab an inspector calls "in progress" is `Queued` and `UnderVerification`
together: a submission that has been accepted and one a run is reading are one
job to the person doing it, and the difference between them is the engine's
business, not theirs. With one value the tab could only ask for one of the two,
so packages in `Queued` appeared under no tab but "all".

The counts made it worse rather than hiding it. The tabs take their numbers
from `GET /packages/overview`, which tallies by `PackageStatus` over a set —
so a tab said one number and listed a smaller one, by construction. Two
screens, two vocabularies, and no reading of either that made them agree.

## Decision

`standing` is a repeatable query parameter. `?standing=Queued&
standing=UnderVerification` is one slice, and a row matches any of the values
named. `ListPackagesRequestSchema` takes either a single value or a list and
normalises to a list; an empty list is no filter rather than a filter that
matches nothing, which is what a caller building the parameter off a set of
cleared tick-boxes sends.

One value still works and means exactly what it meant, so no existing caller
changes. `apps/web` sends one today and keeps compiling.

Inside the context the criterion is `standings: readonly PackageStanding[]`,
empty for "narrows nothing". The condition is an `OR` over the per-standing
condition ADR-0015 already derives from `PackageStanding#facts`: the derivation
is still written once, and this only asks it more than once. A standing named
twice answers the rows it names once, because the same condition twice is the
same set.

The alternative — a named slice in the contract, `?slice=in_progress` — was
rejected. It would put a client's grouping of the standings into the context,
where the next screen's grouping would join it, and the seven standings the
domain does name would stop being what the API is read by. A set of standings
is the client's grouping stated in the domain's own words.

## Consequences

`ListPackagesRequest['standing']` is now `PackageStanding[] | undefined`. That
is a type change for anyone reading the parsed request — the gateway and
`packages.service.ts` — and no change at all on the wire for a caller sending
one value. `RestClient` appends one parameter per value rather than setting
one, which is the whole of the client-side change.

A slice a caller asks for and the count it is shown can now be made to agree,
because both can be taken over the same set of standings. Whether the tabs are
counted that way is `GET /packages/overview`'s question and is not in this
change: it still tallies by `PackageStatus` (ADR-0017), and until it is asked
to tally by standing the two remain two vocabularies over one table.

No migration.
