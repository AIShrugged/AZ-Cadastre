# The order allotting a parcel is a lease-or-use title, and the class of a title is held to the provision

Date: 2026-09-16. Status: accepted.

Supersedes [ADR-0026](./0026-the-year-is-read-off-a-paper-and-the-order-confers-no-right-by-its-kind.md)
in two parts: decision 3, which gave the order of an executive authority
allotting a parcel no right by its kind and read its right off the wording of
the register extract or the plan, and the paragraph of its Consequences that
sent both of the customer's real submissions to 8.0.9.1.2 on that wording.
Decision 5 of ADR-0026 loses its exception for such a title. Decisions 1, 2 and
4 stand.

## Context

ADR-0026 took the order out of the lease-or-use class because both real
submissions carry one beside a register extract stating ownership, and filing
the order by its kind sent both to 8.0.9.1.1. We read the right off the words
of the other paper instead, and said the order's kind decided nothing.

On 2026-09-16 the customer answered question 5 (`Answer_to_questions_RU.docx`,
COMM-101):

> An order of an executive authority allotting a land plot is a lease/use
> right. Lease/use → 8.0.9.1.1 (also needs an approved design or an acceptance
> act). Ownership → 8.0.9.1.2 (the title alone is enough). Every land-title
> document belongs to one of two classes. **Ownership:** register extract,
> state act, 8.0.5 documents. **Lease/use:** 1.1, 1.4, 1.6, 2.2, 2.3, 2.4, 2.5,
> 2.5-1, 2.7, 2.8, 8.0.1. The order falls under items 2.7 and 1.4, so it is
> lease/use. The system takes the right from this classification. If the title
> comes from the wrong class, that is a mismatch. The goal is to stop decisions
> that go beyond the law, even where current practice differs.

The kind of the paper decides; wording on another paper does not override it.

## Decision

1. **The order is a title under items 1.4 and 2.7, of the lease-or-use class.**
   `disposal_order` is listed twice in the table, the way
   `land_allocation_decision` is: under 1.4 before 2006-07-06 and under 2.7
   before 2001-01-01, the windows `GROUND_ITEMS` of the reference implementation
   gives those items. It is a title while either admits its date. It is no
   longer filed under 8.0.1, which is the act disposing of state property
   (`state_property_disposal_act`), a separate paper.

2. **The right comes from the class of the title alone.** Where the package
   carries a title inside its window, the wording of an extract or a plan
   decides nothing. The wording is read only for a package with no title at
   all. Two titles of two classes still leave the right unstated and the
   provision to the inspector (ADR-0025).

3. **A title of the wrong class is `TitleDocumentInvalid`.** The contract's
   `wrongClass` (`GCLASS = {"8.0.9.1.2": "own", "8.0.9.1.1": "lu"}`) is checked
   against every provision the case falls under or is still a candidate for,
   and against the provisions it would fall under on the right an extract or a
   plan words. A lease-or-use title in a case that is, or by its wording would
   be, one of 8.0.9.1.2 is reported, filed against the document and no field
   of it. The register's own extract (item MQS) is never held to a class, as
   in the contract, and a title outside every window is not reported twice.

4. **Offering a title.** Where the decided provision rests on one class, the
   operator is offered the titles of that class only. The order is not offered
   for 8.0.9.1.2.

## Consequences

Every title in the table names a right. `TitleDocumentStanding.landRight` in
the domain is no longer nullable; `TitleDocumentStandingDto.landRight` stays
nullable so the API contract does not move — it is simply never null now.

The customer's two real submissions — an order beside a register extract
stating ownership, pre-2013, no taller than 12 m, on land for housing — carry
two titles of two classes. The right is unstated, the case is
`ProvisionUndetermined` between 8.0.9.1.1 and 8.0.9.1.2, and the order is
reported `TitleDocumentInvalid` as of the wrong class for 8.0.9.1.2. Which title
the case stands on is the inspector's call: on the order, the applicant owes an
approved design or an acceptance act (8.0.9.1.1); on the extract, nothing more
(8.0.9.1.2) and the order is the mismatch. Where the extract is only a wording
on a plan and not a paper of its own, the order decides: 8.0.9.1.1, the design
or acceptance act is asked for, and the order is still reported as of the wrong
class for the 8.0.9.1.2 the wording points at. As before, without a paper
stating the year both are undecided on the year first (ADR-0026, decision 2).

An order dated from 2006-07-06 is outside both windows: it is reported
`TitleDocumentInvalid` and founds no right (ADR-0026, decision 4).

Stored reports are not rewritten. A re-run recompiles them.
