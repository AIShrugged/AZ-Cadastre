# The archive register is a source outside the system, reached through a port, and answered today by a stand-in

Date: 2026-08-25. Status: accepted.

Follows [ADR-0003](../../packages/verification/docs/adr/0003-external-capabilities-behind-ports.md),
which put every external capability behind a port, and
[ADR-0006](./0006-contexts-contracts-edge-and-composition-root.md), which says
what a context may import and where a binding is made. It extends
[ADR-0002](../../packages/verification/docs/adr/0002-profile-driven-validation.md):
a profile now declares a third kind of rule.

## Context

Everything the system checks today, it checks inside the envelope. The five
cross-checks of the `cadastre` profile hold one paper of a submission against
another: the name on the identity card against the name the application is made
in, the area on the plan against the area the order allotted. A submission that
agrees with itself passes, whether or not any of it is true. There is no second
source.

There is one available. `Cadastre Archive Registers` — the analysis of the 55
register sheets the archive keeps — describes a normalised record spine:
a property object in a district, titled by an instrument issued to a party,
filed at a folder-and-page location. Two keys make records joinable: **register
no** on the property and **folder no + page range** on the archive location. It
would answer questions the envelope cannot: is there a record of this address at
all, who does it say holds the property, what area does it say, and where is the
paper.

Three things about that source shape the decision:

- **It is not ours and it does not exist yet as a service.** There is no API. The
  data is 55 spreadsheets, and ingesting them is a project of its own — the
  analysis lists ten decisions that have to be made before a row can be loaded,
  from an Azerbaijani legacy Cyrillic code page that is not Russian to folder
  and page columns whose real values include `01-dən 30`.
- **Its coverage is partial and historical.** It records the privatisations of
  the 1990s and 2000s. A new house on a newly allotted plot is not in it, and
  never was.
- **Comparing an address to a record is a rule, not a string comparison.** The
  same place is written `Suraxanı r., Zığ qəs., H.Əliyev küç. 12`, `Zığ
qəsəbəsi, Əliyev küçəsi 12` and `Зығ гясябяси, Ялийев кцчяси 12`.

## Decision

1. **A published language for the register, in `libs/api-contracts/registry`.**
   `ArchiveRegistryApi`, one area — `addresses` — and the DTOs behind it. Both
   sides import it; neither declares the message locally.

2. **The register answers with facts and never with a verdict.** The response
   says what it holds — `Found | NotFound | Ambiguous`, the address as the record
   spells it, one line per supplied attribute saying `Matches | Differs |
NotRecorded`, and the archive locator — and there is no `valid` in it. What
   an absent record or a differing owner means for a submission is a rule of the
   profile, applied by the stage that asked. A register that returned a verdict
   would be a second owner of the decision, and the inspector is the first.

3. **Verification consumes it through `ArchiveRegistryPort`**, an abstract class
   typed by the contract and narrowed to the area it calls. Two adapters, chosen
   by `REGISTRY_PROVIDER` exactly as the five model-backed stages are chosen:
   `mock` is a stand-in built into the context holding three records and comparing
   letter for letter — so the pipeline runs offline, as every other provider does
   on `mock` — and `http` calls whoever serves the contract.

4. **A sixth stage, last in the run.** It needs the values every stage above it
   produced, and it is the only one that leaves the submission. It is wrapped in
   the same `despite` as the others: a register that is down does not fail a
   verification.

5. **The profile declares which values are looked up.** A `registryCheck` names
   the subject — `[document type, field]`, the address the finding is filed
   against — and the attributes held against the record, each with the name the
   register knows it by. The rule stays in the profile, where the other two kinds
   of rule are, rather than in the adapter.

6. **Two issue kinds, and deliberately not one.** `RegistryMismatch` is a record
   that says something else: a finding against the package. `RegistryUnconfirmed`
   is a register that held no record, or held two: told to the inspector and
   counted for nothing, like `ExtraDocument`. Collapsing them would make the
   partial coverage of a historical archive look like a fault in every new
   submission.

7. **The stand-in is `apps/registry-stub`, an app and not a context.** It has no
   language of its own — it speaks the contract — and it decides nothing. It
   holds an HTTP edge, a `RegistrySource` port and one adapter that reads records
   from a fixtures directory. When the register files are ingested, a second
   adapter answers the same port; when a real state register appears, the app is
   deleted and a base URL changes.

8. **The matching rules are an engine, `libs/matching-engine`.** Whether two
   ways of writing one thing mean the same thing — an address, a person's name,
   an area, a reference number — as pure functions with an empty dependencies
   block, including the Azerbaijani legacy Cyrillic→Latin table the archive files
   need. It is an engine and not a helper inside the stub because a stand-in
   whose matching is looser or tighter than the real thing's teaches nothing:
   whatever replaces the stub answers from this same source. It is named for the
   question rather than for the address, because the address was only the first
   value it was asked about.

## Alternatives rejected

**A second bounded context, `packages/archive-registry`, now.** It is where this
ends up if the 55 files are ingested and we own the data. Today we own no data:
the context would be a name with fixtures behind it, and `libs/api-contracts`
would have to be split into per-context packages (`TECH_DEBT.md` §2) to hold a
language nothing speaks yet. Building the app first costs one deletion later and
keeps `packages/` honest.

**A table inside verification.** The archive is not verification's model. Holding
it there would make a submission and the record of a registration one aggregate,
and the first cross-context join would be written the day after.

**Returning `valid: true | false` from the register.** Simplest to consume and
wrong: the register does not know what is being registered, so its opinion would
be about its own holdings while reading as an opinion about the package. Every
caller would then have to un-decide it.

**No mock adapter in verification, only the HTTP one pointed at the stub.** One
fake instead of two. It would also mean `pnpm test` and `pnpm dev` need a second
process running, which no other stage in this repository requires.

## Consequences

- **There are two fakes, and they do not agree.** The stub matches addresses with
  the engine; the offline adapter compares letter for letter. That is on purpose
  — the offline one says so in every note it writes, and a spec asserts it — but
  a run on `mock` will report `RegistryUnconfirmed` for an address the stub would
  have found, and anybody reading such a report has to know which one answered.
  The start-up line says which.
- **A new finding kind reaches a client that has not been taught it.** `IssueKind`
  is a published enum; `apps/web` renders what it does not recognise as its raw
  key until it is given wording.
- **The register is asked about one address per package.** A submission naming
  two properties gets one lookup, against the first `application.property_address`
  read. Nothing in the profile can express the second today.
- **`registryChecks` are persisted but not published.** The findings reach the
  report and the client; the checks themselves — including the archive locator on
  a confirmed one, which is the most useful thing here for an inspector — are in
  `registry_checks` and not yet in `PackageDetailDto`. That is the next piece,
  and it is a DTO plus a read model, not a decision.
- **There are now two implementations of the same folding.** The engine and
  `packages/verification/src/domain/services/value-agreement.service.ts` both
  lower-case, decompose, strip marks and map `ə`/`ı` — the same rule, written
  twice, and the second one already knew about the dotted capital `İ` that the
  first got wrong on its first real call. They are separate because the boundary
  says so: a context may not import an engine today, and that service is
  verification's rule about its own papers rather than the register's about its
  records. `TECH_DEBT.md` §7 says what fires and what to do.
- **The matching engine will be wrong about some addresses.** It binds a level to
  the word next to it and forgives a level one side omits; it does not parse
  Azerbaijani addresses properly, and it treats a Russian street name with the
  Azerbaijani legacy table. It is written to be read and corrected, and every
  rule in it is one spec.
