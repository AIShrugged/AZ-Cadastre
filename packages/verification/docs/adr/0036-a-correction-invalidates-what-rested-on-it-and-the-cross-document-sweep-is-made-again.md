# A correction invalidates what rested on it, and the cross-document sweep is made again

Date: 2026-09-22. Status: accepted.

Supersedes point 9 of
[ADR-0033](./0033-an-operator-enters-a-value-and-the-package-is-verified-again.md),
which had a correction discard everything worked out across the package. The
rest of ADR-0033 stands unchanged. Narrows what
[ADR-0013](./0013-a-package-takes-more-files-until-a-run-is-reading-it.md) means
by re-opening to the one way in it was written for — a file arriving — and
reads
[ADR-0016](./0016-the-approval-of-an-archive-search-is-an-event-and-it-is-spent.md)
as it is worded: an approval ends when the answers it covered stop standing,
which is not the same as an operator having typed something somewhere. The
archive QR check of the edited paper goes on being dropped, for the reason
[ADR-0028](./0028-a-decree-439-paper-is-held-against-the-archives-copy-by-its-qr-code.md)
gives.

## Context

An operator fixes a house number, presses save, and the case rail goes blank.
Every cross-document verdict, every answer the register gave and the report
disappear at once, and the screen says nothing about the package until the run
that follows has finished. The requester saw it and called it wrong:

> сейчас перезаписывается статус чеклиста - это не корректно. Не
> перезаписывать полностью, а только то что аффектит. Триггерить нужно полную
> кросс-документную сверку после обновления.

Two things in one sentence, and they pull in different directions on purpose.
Invalidate only what the edit affects — and make the _whole_ cross-document
sweep again after it.

ADR-0033 point 9 said the opposite of the first half, and said why: the edited
value may be a side of any check, and working out which "is a guess this system
should not be making". That premise no longer holds, and arguably never did.
`CrossCheck` and `RegistryAttribute` both carry `CheckedValue`, which names the
document and the field key a value was read off. What a check rested on is
written on the check. Nothing has to be guessed.

What is genuinely different between the two kinds of check is not how hard they
are to attribute but what they are. A registry check is a question put to an
outside system about a named value read off a named sheet: change that value
and the answer is about something else, leave it alone and the answer is still
the answer. A cross-document check is the package held against itself, and
which papers are compared at all follows from what the papers state — so a
corrected value reaches further than the checks that happen to name the key it
was typed under. That is why the requester asks for the full sweep and is
right to.

And the blank rail is a third thing again. Discarding a verdict and re-making
it are the same act on the server and two different sights on the screen: one
is a checklist that lost its answers, the other is a checklist being brought up
to date. The inspector cannot tell them apart, so the state has to.

## Decision

1. **A correction no longer re-opens the package the way a file arriving
   does.** `reopen()` is the file-arrival path and stays exactly as it was —
   a new file changes what the envelope holds, so nothing worked out over the
   envelope survives it (ADR-0013). `editFields` has its own, narrower
   invalidation, and the two lists are not the same list because the two
   events are not the same event.

2. **Every Cross-document Check is marked outrun, and none is thrown away.**
   The verdict, its confidence, its note and the values it weighed stay
   exactly where they were and go on being published. What the mark changes is
   that the package no longer counts the check as made, so the run that
   follows makes all of them again — the full sweep the requester asked for,
   and not only the checks that name the edited key.

3. **The inspector reads the last verdict until this run replaces it.** That
   is the whole reason a mark was chosen over a deletion. An operator pressing
   save is looking at the rail, and a rail that empties for the length of a run
   tells them the package lost its answers rather than that it is working them
   out again.

4. **A verdict the run did not renew is dropped when the run completes.** A
   check that could not be made this time — a value it weighed was struck out,
   or the paper stating it went — would otherwise leave a verdict about a
   package that no longer exists, and the report is compiled from these.
   Completing is where the sweep is known to be over, so completing is where
   it happens.

5. **A Registry Check is kept unless the edit reaches it, and whether it does
   is derived twice.** From the check: every `CheckedValue` it carries — what
   was asked, every attribute submitted, every paper carried — names the
   document and key it came off, and a check weighing a corrected reading was
   made over something the package no longer states. And from the profile: a
   key the check's spec reads off this document type is a value it _would_
   have used, so typing one in under a key that was blank changes what the
   register would be told as surely as changing one that was not. Either
   answer drops the check, and the run asks the register again.

6. **The signature on the archive search is spent only where a Registry Check
   is dropped.** ADR-0016 ends an approval because the answers it covered no
   longer stand. Where every answer still stands, the person who signed for
   them signed for what the package still holds, and making them sign again
   would be ceremony. Where one goes, the approval covered an answer that is
   being asked again, and it is spent — by this path and by
   `recordRegistryCheck`, which is the other one.

7. **The Verification Report goes.** It is compiled from the checks that are
   being made again, and half of it beside fresh verdicts would be a finding
   about a submission nobody made. The report is the run's own statement and
   is rebuilt from scratch every time; the rail is drawn from the checks and
   the gaps, not from the report, so nothing an operator is reading goes blank
   with it.

8. **Everything else ADR-0033 decided stands.** The Archive QR Check of the
   edited paper is still dropped and no other is (ADR-0028). Values carried
   over from the edited key are still stripped wherever they sit (ADR-0023).
   The no-op rule, the fourth origin, the confidence of certainty, the audit
   columns, `@RequiresRole('operator')` and the `DOCUMENT_NOT_IN_FORCE`
   refusal are untouched.

## Consequences

`cross_checks` carries an `outrun` column, false for every row written before
this and false again the moment a run records the check. The repository already
deletes the checks the aggregate no longer holds, which is what makes a partial
invalidation land: the registry checks that were dropped leave the database
with their attributes and documents, and the kept ones are upserted as they
were.

Nothing published changes shape. `PackageDetailDto` and the contracts under
`libs/api-contracts/src/verification/` are untouched: the mark is how the
package decides what to do next and is no business of a reader's, and the
checklist in `apps/web` is an index over what the server publishes, so a
correction that keeps the verdicts keeps the rail.

A correction now costs the register a lookup only when it has something new to
ask about. That is the point, and it is also the one thing to watch: the
derivation in decision 5 is a superset of "the check names this value", and a
profile that grows a registry check reading a key off a type no `CheckedValue`
records will still be invalidated by it — deliberately, because the failure
that matters is keeping an answer that is no longer about the package, never
asking the register one more time than strictly necessary.
