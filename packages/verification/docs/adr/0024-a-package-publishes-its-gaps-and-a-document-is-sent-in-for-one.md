# A package publishes its gaps, and a document is sent in for one of them

Date: 2026-09-11. Status: accepted.

Extends [ADR-0013](./0013-a-package-takes-more-files-until-a-run-is-reading-it.md),
whose `addFiles` re-opens a package and re-reads nothing it has already read,
and [ADR-0016](./0016-the-approval-of-an-archive-search-is-an-event-and-it-is-spent.md),
whose rule for ending an approval this reuses rather than inventing a second
one.

## Context

An operator could add files to a package and nothing else. The package had no
idea what any of them was for.

That is the wrong shape for what an operator actually does. They are not
"adding files to a submission": they are answering a particular line of a
report — _this_ technical passport, because the scan of the one that arrived is
unreadable; _this_ archival certificate, because the envelope came without one.
The system gave them one verb for two different asks and then could not say
afterwards whether either had been answered.

Three things followed from that.

**A replacement was an addition.** A better scan of a paper already in the
package joined it beside the bad one. The report then held both — the doubtful
reading it started with, and a duplicate document — and the finding that sent
the operator to upload anything in the first place was still there.

**Nothing checked what arrived.** Attach the payment receipt where the sketch
design was wanted and the package took it in silently, as one more file. The
gap stayed open with nothing anywhere connecting it to what had just been sent.

**Whether an upload was possible at all was nobody's answer.** A screen that
decided for itself where to draw an upload button would sooner or later draw
one the server refuses, and hide one it would have taken.

## Decision

1. **The package publishes its gaps, and the rule is the server's.**
   `PackageDetailDto.gaps` is the whole of what the supply operation will
   accept, and `POST /packages/:id/documents` refuses anything that is not on
   it. The rule lives in one domain service, `gapsIn`, which the aggregate and
   the detail query both answer with — the read side holds rows and never loads
   the aggregate, so a rule of its own there would be a second offer. The
   `attestationOf` service is shaped this way for the same reason.

   Three reasons, distinguishable, because an operator answers them
   differently: `MissingDocument` (a required paper no document in force
   answers), `UnusableScan` (a paper that is here and was read badly — a field
   the profile asked of it that its sheets did not yield, or anything read off
   it below the floor, the placement included), and `AlwaysAccepted` (a paper
   the profile takes whenever it turns up, whether or not the package is short
   of one). The last is a **profile declaration** — `alwaysAccepted` on the
   document type — and not a key the engine knows: the receipt for the state
   duty happens to be the one type that carries it today, and hard-coding
   `payment_receipt` in the engine would be policy written into the machine.

   A required type that is genuinely absent is published once, as
   `MissingDocument`: the always-accepted pass only adds an entry where the
   missing pass did not.

2. **One threshold for the whole product, and it moves to 0.85.**
   `Confidence.FLOOR` decides both what the report doubts and what the package
   offers to be sent again, and it is published to clients as
   `CONFIDENCE_FLOOR`. A second number beside it — one for the report, one for
   the offer, one kept by a screen — is two products: the first time they
   disagree, a value is highlighted that the report is content with, or a
   flagged one reads plain. The cost of the raise is accepted and is the point:
   more readings are doubted, and packages that used to report clean now carry
   `LowConfidence` findings an inspector is asked to look at.

3. **A separate operation, not a target bolted onto `addFiles`.** The two are
   different asks. `addFiles` is more of the envelope: any number of files,
   answering nothing in particular. `supplyDocument` is one file that answers
   something, and it carries what it answers. One file because a target names
   one document — a target on a call that takes many would have to mean either
   "each of these" or "these together", and neither is a thing an operator
   asks for. An optional target on `addFiles` would have made the required
   fields of the one ask into the ignorable fields of the other.

4. **What arrived is checked twice, and the two checks answer different
   questions.** At the call: that the package publishes a gap for this target,
   refused with `NO_SUCH_DOCUMENT_GAP`. In the run, once the classifier has
   placed what arrived: that it is the expected type — and where it is not, the
   supply is refused, the gap stays open, the document it was meant to replace
   stays in force, and the report carries a `WrongDocumentSupplied` finding
   naming what was asked for and what turned up.

   The second check is **not** made at the call, and cannot honestly be: nothing
   has read the file yet. Refusing there would mean splitting, reading and
   classifying a scan inside the HTTP request that uploaded it — a second copy
   of the pipeline living in a command handler. Putting it in the run is also
   the order the requirement is written in: the document is the one that was
   asked for, then its fields are read, then it is held against the papers
   already here.

5. **A replaced document is never deleted.** It goes out of force with the
   stamp of what replaced it and when, and stays in the package. A submission
   is evidence and not a working draft — the same principle that keeps a
   machine reading on file once a better one exists. Everything worked out
   _about_ the package reads `documentsInForce`: the report, the cross-document
   checks, the questions put to the register, the three values a row names the
   case by. Everything that addresses a document by its id goes on seeing all of
   them.

   The values other papers had borrowed from a replaced document are dropped
   with it. A carried-over value is nothing but a pointer at the reading behind
   it (ADR-0023), and the next run gathers again off the paper now in force.

6. **A supplied document goes the whole way.** The event the supply raises is
   answered by the same handler as `FilesAdded`, so the package re-opens, the
   answers worked out across it are discarded, and it is verified afresh — read,
   placed, its fields extracted, held against the papers already in the
   envelope, the register asked again, the report compiled from scratch. Nothing
   already read is read twice (ADR-0013).

7. **An approval of the archive search ends the way it always does.** A supply
   changes the papers the register was asked about, so it spends whatever was
   signed for the last answers — through the one path that ends an approval, not
   a second rule (ADR-0016).

## Consequences

More packages carry `LowConfidence` findings than before, and some that used to
report clean no longer do. That is the raised floor doing what it was raised
for.

A package can now hold documents that are not part of what it states.
`documents` and `documentsInForce` are different lists, and a reader that wants
what the package says must ask for the second. The aggregate's own rules do;
so does the detail query, which skips superseded documents when it names the
case. Anything added later that reasons about what the package holds has to
choose, and choosing wrong is silent — this is the cost of not deleting, and it
is a cost worth paying.

`WrongDocumentSupplied` is a kind of finding that is about the operator's last
action rather than about the envelope. It is the first one, and it is held
against the package rather than stated for the record, because the gap it
reports is still open and there is still something to do.

There is no record of _who_ sent a document in, for the reason there is none on
an approval: the system has no accounts, and a name here could only be one
somebody typed (ADR-0016).
