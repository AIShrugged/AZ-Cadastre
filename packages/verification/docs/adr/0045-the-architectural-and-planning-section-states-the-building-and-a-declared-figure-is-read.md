# The architectural and planning section states the building, and a declared figure is read

Date: 2026-09-24. Status: accepted.

Amends [ADR-0025](./0025-the-required-set-is-the-provision-of-article-8-the-case-falls-under.md),
which decided where each of the six figures of Article 8 is read, and works with
[ADR-0043](./0043-the-span-is-calculated-off-the-axis-chains-and-the-unit-off-the-built-up-area.md),
which decided how the span is got out of one of them.

## Context

The reference sketch design PROJE44 went in as a case of its own on production
(`8e86886b`). The model read it well — `storeys = '2'` at 0.94,
`building_height = '6.20m'` at 0.94, the axis chains at 0.60 — and every one of
the six parameters came back null, `outcome: Ambiguous`, `undecidedOn` all six.

The classifier had placed the set as `architectural_planning_section` at 0.80,
and the table of provisions took storeys, height and span off two types only:

```
storeys: [['sketch_project','storeys'], ['approved_design','storeys']]
```

The profile declares all three fields on `architectural_planning_section`. So
the field was asked for, read off the page, stored on the document — and
`provisionOf` never looked for it. `guardProvisionsAreDeclared` checked one
direction of the promise — every field the table names is declared by its type —
and the gap was in the other direction, where nothing looked.

Two separate faults, and the second holds whichever way the first goes.

## Decision

1. **The architectural and planning section is a place the three figures of the
   building are printed**, after the sketch design and the approved design, in
   `storeys`, `height` and `span`.

   It is not merely admissible, it is required: 8.0.10.1 and 8.0.10.2 both ask
   the package for this very section, and 8.0.10.2 is decided on at most three
   storeys, twelve metres and six-metre spans. A package of the provision that
   carried no sketch design would state none of the three figures the provision
   turns on — the case would be Ambiguous on a paper that prints all three. The
   alternative, striking the fields from the type's schema, would settle the
   inconsistency by making that case permanently undecidable.

   The order is the usual first-hit walk (ADR-0010): the sketch design is
   required of every package (Article 10.2.3) and is believed first; the
   approved design next; the section of one last.

2. **Every paper a span may be read off is asked for its own built-up area.**
   The span is calculated off the chains of one paper and the unit decided by
   the area that same paper states (ADR-0043). `built_up_area` was declared on
   the sketch design alone, so a span read off either of the other two designs
   fell back to the rule that a drawing is dimensioned in millimetres — a guess,
   where the paper had the figure that settles it. It is now declared on all
   three.

3. **A field declared under a figure's key on a paper no row names is refused
   at import time**, by `guardFiguresAreTaken` — the other side of
   `guardProvisionsAreDeclared`. The check is on the key and not on every field:
   a key is what says two papers print the same thing, and a field under no key
   the table reads has nothing to do with Article 8.

   Three fields of this profile carry such a key and are legitimately not the
   figure. They are named in the table under `notFigures`, each with the reason,
   because the guard refuses every one that is not:

   - `construction_permit.permit_date` — the permit dates the start of a
     construction and the regime turns on the year the house was built
     (ADR-0026);
   - `archive_certificate.issue_date` and `identity_card.issue_date` — neither
     is a title, and no window is held against either date.

4. **The two designs are told apart on their composition and their approval,
   not on their heading.** PROJE44 is "Movqe planı; Baş plan; Bünövrə planı;
   1-ci mərtəbənin planı; 2-ci mərtəbənin planı; Kesim; Fasad" — a complete set
   standing on its own, with no authority's approval and no larger design named
   above it, which is a sketch design. The architectural and planning section is
   a part of an approved design and says so in its title block. Both
   descriptions now say this to the classifier, which is the only place that
   decides it.

## Consequences

Cases already run are not re-decided: the provision is worked out on every read
and never stored (ADR-0014), so `8e86886b` shows the figures as soon as it is
looked at again — no migration and no backfill.

A package that carries both a sketch design and a planning section is unchanged:
the sketch design is still first, and a reading it could not make sense of still
stops the walk rather than falling through to a paper the profile believes less.

The classifier change is a change to a prompt and cannot be asserted on. What
can be, and is: the guard, the order of the three chains, and what a package
carrying only the section now decides.
