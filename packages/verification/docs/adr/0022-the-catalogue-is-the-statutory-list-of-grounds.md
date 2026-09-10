# The catalogue is the statutory list of grounds, not the papers we happened to see

Date: 2026-09-10. Status: accepted.

Extends [ADR-0012](./0012-a-catalogue-of-documents-no-profile-asks-for.md) and
supersedes none of it. That ADR built the catalogue and said what it is for.
This one changes where its contents come from, and with them what the catalogue
claims to be.

## Context

ADR-0012 wrote down six papers, and said so plainly: "It is what the customer's
envelopes have been seen to carry, not a guess at everything that could turn
up." Six was the number of service sheets an inspector had mentioned — a routing
sheet, an examination sheet, a designer's licence, a valuation contract, a
courier waybill, a covering letter. The list was to grow one observed document
at a time.

It did not grow, and the customer said why: "documents outside the profile are
not recognised very well. There is a PPTX in the repository, the example
application — that PPTX has every possible document in it. Those are the ones we
identify. Everything else we mark as 'other documents'."

The gap is not six entries wide. The seven types of the `CADASTRE` profile are
the papers of one first registration of one new house. Every OTHER ground on
which a right may be registered in Azerbaijan — every notarised contract, every
court decision, every Soviet-era land record — arrived in the report as an
unnamed `out_of_profile`. The paper was read, its heading was legible, and the
report said only what it was not. A title document is the most important sheet
in the envelope, and it was the one the engine had no word for.

The list the customer pointed at is not a guess either. It is the law: Article 8
of the Law "On the State Register of Immovable Property" enumerates the grounds
for registration, and its point 8.0.8 refers out to the list approved by
Presidential Decree No. 439 of 13 January 2015 for rights that arose before the
Law. The customer's own workbook —
`Fedor Zhernovoy/Example application/Individual residential houses/`
`Document-Checklists State Registration AZ-EN.xlsx` — is that enumeration in a
machine-readable form, one row per ground, with the issuing authority, the date
window and the number of the slide in the deck that shows a real scan of it.

## Decision

1. **The catalogue's source is the statute, not observation.** `DocumentCatalogue.KNOWN`
   is derived from the customer's checklist workbook and the deck of sample
   scans beside it: every ground Article 8 lists, every ground the Decree No. 439
   list names, the papers the general application package carries beside the
   profile's own, and the six service sheets ADR-0012 started from. Forty-eight
   entries where there were six.

   This is a change of standing, not a longer list. ADR-0012's catalogue could
   be silent about a paper without being wrong — nobody had seen that one yet.
   This one cannot: a ground the law names and the catalogue does not is a
   defect, and the workbook is the thing to check it against.

2. **One entry per KIND of paper, not one per row.** Several rows of the
   workbook name the same document under two issuers or in two date windows —
   land records from an economic department and from a technical inventory
   bureau (points 1.1, 1.2); decisions allotting land plots before 1991 and
   between 1991 and 1995 (points 1.4, 2.2); certificates of a right issued
   before 6 July 2006 and between 2006 and 2009 (Articles 8.0.5, 8.0.12). Each
   is one entry naming both, because two keys for one paper give the classifier
   two right answers to one question and it will pick between them by coin.

3. **A date constraint is prose in the `description` and nothing else.** Half
   the Decree's points are bounded by a date — "drawn up before 1 January 2001",
   "issued before 6 July 2006" — and the date is a good way to recognise the
   paper. It is not a rule here. The classifier is told in as many words never
   to reject a key because the document is dated outside its window and never to
   report the date as a fault. Whether a document may be USED given its date is
   a requirement of a profile, and no profile asks it yet.

4. **The prompt is grouped, and the grouping belongs to the catalogue.**
   `DocumentCatalogue.groups` — grounds under Article 8, grounds under the
   Decree, papers of the application, the registry's service sheets — each with
   the heading it is printed under. Fifty keys in a flat run are read worse than
   four labelled groups, and which group an entry is in is a property of the
   entry, not of one adapter's wording. The answer contract is unchanged: one
   key, a confidence, a reason.

5. **`out_of_profile` keeps its key, and says something much stronger.** The key
   is in the database of every package already verified and renaming it would be
   a migration with nothing behind it. What changed is what it asserts: "none of
   the keys above names it" was a claim against thirteen keys and is now a claim
   against fifty-seven, so the prompt says so and tells the model to reach for a
   key whenever the document is plausibly one. What the inspector reads — "other
   documents" — is a string in the client's own translations, not this key.

6. **A catalogued heading that ENCLOSES a profile heading wins.** ADR-0012 rule 4
   has the profile beating the catalogue outright, so that a document readable
   as either is read as the profile's. That is right for two headings that both
   appear on a sheet, and wrong for one heading inside another: the profile is
   headed "паспорт" for an identity card and the catalogue "технический паспорт"
   for a building's, and a profile-first ask answers every technical passport
   with `identity_card` — a seven-letter match twelve characters in, beating an
   exact one that starts the sheet. The offline classifier now consults both
   lists and prefers the catalogued match only when it contains the profile's.
   Two headings that merely both appear still go to the profile.

7. **The segmenter is shown headings and not descriptions.** ADR-0012 rule 7
   stands — its list is still the catalogue's, from one place — but it prints
   the key and its headings per entry, grouped, rather than the full entry. That
   stage has to notice a heading started; only the classifier has to tell one of
   these papers from its neighbour, and only it should pay for the prose that
   does.

## Alternatives rejected

**Adding the grounds to the `CADASTRE` profile as optional types.** They would
be `isKnown`, so they would be placed, carry field schemas and answer
requirements. A ground under Decree No. 439 does not close any requirement of a
first registration of a new house, and making it look as if it might is the one
outcome worse than not naming it.

**A key per row of the workbook, fifty-six of them.** Faithful to the document
and useless to the model: it would be asked to tell 8.0.5 from 8.0.12 by a date
it has been told not to judge by, and to tell point 1.1 from point 1.2 by which
Soviet department signed a form that names both.

**Loading the workbook at start-up instead of writing the list in code.** The
catalogue would then be a file somebody can replace, and every classification
would depend on a parse of a spreadsheet whose sheet names have already been
seen to drift between its Azerbaijani and its Russian copies. Policy the engine
interprets lives in code (ADR-0002); the workbook is what the code is reviewed
against.

**Keeping the six-entry catalogue and adding a second list for grounds.** Two
lists that mean the same thing to a classifier and differ only in where they
came from. The reader would have to consult both, the segmenter would have to be
given both, and nothing about a paper would tell you which list it should be on.

## Consequences

- **The classifier's system prompt grew from about 6,300 to about 25,000
  characters** — roughly 1,900 to 7,400 tokens — sent once per document. It is a
  fixed prefix, so a provider that caches prompts pays for it once per run; a
  provider that does not pays it per document. This is the price of the change
  and it is stated rather than hidden: if it has to come down, the lever is the
  length of the descriptions, not the number of keys.
- **The segmenter's prompt shrank against what it would otherwise have been.**
  Printing the full entries there would have cost about 19,700 characters per
  file; headings-only costs about 8,600.
- **A run over the same package reports fewer unnamed extra documents and more
  named ones.** No verdict moves: a named ground still answers no requirement,
  still counts for nothing against the package, and still lands in the report as
  the informational extra document it was.
- **The frontend needs a label per key in three languages.** The report renders
  a finding by its key, and forty-two keys that no translation file has yet will
  render as keys. That work is a task of its own; this ADR's list is its input.
- **The catalogue can now be wrong in a way it could not be before.** It claims
  to cover a statute. When the statute changes — a point added to the Decree, an
  article amended — the catalogue is out of date, and nothing in the system will
  say so. The workbook is the thing to re-read, and the entries name their
  article and point so that a reader can.
