# AZ-Cadastre — Document Verification

AI-assisted verification of document packages submitted for government registration (target domain: cadastre; the mechanism is domain-agnostic). The system prepares a verification report; the legal decision is always made by a human inspector.

## Language

**Verification Package**:
A set of files submitted for one verification. The unit the inspector works with. Files may reach it after it was created — the document the report said was missing — in every state but while a run is reading it, and a file that arrives discards the report the package had (ADR-0013).
_Avoid_: submission, case, batch

**Source File**:
One file the inspector uploaded. A container, not a document: a single PDF may hold a passport on sheet 1 and a title deed on sheets 2–4. It carries the original name, the format and the object it was stored under.
_Avoid_: document (when meaning the file), attachment, upload

**Document**:
One logical document found inside a Source File: a contiguous run of that file's Pages carrying exactly one Document Type. Discovered by segmentation, never declared at upload — the inspector attaches files, and the engine reports the documents in them. A file's Documents tile it: back to back, no gaps, no overlaps.
_Avoid_: file, scan, attachment, segment

**Page**:
A single image derived from a Source File (one per PDF sheet; an image file is one Page). Numbered across the whole file, so a Document's page range points at the sheets an inspector would turn to. The unit sent to OCR.

**Document Type**:
The recognized category of a Document (e.g. Passport, Unknown). Assigned by classification, never by the file name.
_Avoid_: category, kind

**Extracted Field**:
A single structured value the pipeline holds against a Document: value + confidence + where it came from. Where it came from is its Field Origin, and it decides what the page reference means — a value read off this Document cites a sheet of it, and one carried in from elsewhere in the package cites none. Not always the pipeline's: an operator who can read what the scan could not states the value by hand, and it then carries their account and the moment they typed it, replacing whatever was there (ADR-0033). A machine reading never writes over one of theirs, and a document whose only values are theirs has not been read by anything — which is why the extraction stage counts machine readings and not fields.
_Avoid_: attribute, property

**Field Origin**:
Where an Extracted Field's value came from, in one word: read off this Document, taken from another paper of the same Verification Package, read here and confirmed by the archive register, or entered by an operator off the paper in front of them (ADR-0023, ADR-0033). Four states and not a flag, because they are not degrees of one thing — a reading is evidence about this paper, a value carried over is evidence about the package, a confirmation is evidence from outside it, and a value a person typed is their own reading of the paper. Only a value read here answers for the Document it hangs on, and an operator's is one: a person read the paper, so it may be a side of a Cross-document Check and may be what the register is asked about — the whole point of it, since otherwise the correction would change nothing downstream. It is certain rather than confident, and never a low-confidence finding. A carried-over value, by contrast, answers for nothing, because the reading behind it is already reported against the paper it was made on. The register's agreement is never recorded on an operator's value: where it came from is still a person, and the agreement is already on the Registry Check. Which papers print one value is the Verification Profile's cross-checks and nothing else, and where they do not speak with one voice the field stays empty rather than being guessed at.
_Avoid_: implicit, inferred, source, derived value, override

**Document Catalogue**:
A reference list of Document Types that no Verification Profile asks for, but that arrive in the envelopes anyway. Its contents are the statute, not observation (ADR-0022): every ground for state registration Article 8 of the Law enumerates, every ground the Decree No. 439 list names, the papers of the application the profile does not ask for, and the registry's own service sheets. Grouped, because whoever classifies is shown fifty keys at once. Matching one names an out-of-profile Document in the Verification Report instead of leaving it a generic "other documents"; it never places the Document, answers a requirement or carries fields (ADR-0012).
_Avoid_: extra types, known documents, secondary profile

**Particulars**:
What a Verification Package is called outside this system: the applicant, the address of the property and the cadastral number of the parcel, as the pipeline read them. Not a check and not evidence — nothing here is compared with anything — but the answer to how a submission is named in a list, where its id and its profile key say nothing a person recognises. Which field of which Document Type each is believed from, and in what order, is the Verification Profile's to declare; the first of the papers it names that the package actually states is the one that answers, and where none does the value is absent rather than blank. Read off the Extracted Fields on every request and stored nowhere, for the reason a Package Standing is (ADR-0018).
_Avoid_: title, headline, summary, metadata

**Verification Profile**:
A declarative definition of what a valid Package looks like: which Document Types exist, their field schemas and sources, which documents are required of every package, the table of Article 8 Provisions that decides the rest, and the cross-document rules. Domains (cadastre, …) are expressed as profiles; the engine only interprets them.
_Avoid_: ruleset, config, template

**Cross-document Check**:
One of the Verification Profile's cross-document rules, applied to a Package: the values several Documents must state alike (the name on the identity document against the applicant on the application), the verdict — Match, Mismatch or Unclear — and every value it weighed. A check that agreed is kept, not only the ones that failed. A Correction marks every one of them outrun rather than discarding them: the package counts none as made, so the run that follows makes the whole sweep again, and the inspector goes on reading the verdict each had until it is replaced (ADR-0036). A verdict that run could not make again is dropped when it completes.
_Avoid_: comparison, consistency rule, match

**Article 8 Provision**:
The provision of Article 8 of the Law a first registration falls under — 8.0.9.1.1, 8.0.9.1.2, 8.0.9.2, 8.0.10.2 or 8.0.10.1 — decided on the six Case Parameters by the Verification Profile's table of provisions, the first row whose conditions all hold. It is what decides which papers a Verification Package must carry beyond the plan of the plot, the sketch design and a Title Document. A figure nobody could state never decides a row: the provisions it leaves open are candidates, and the case is Ambiguous; a case no row covers is Undetermined; both are told to the inspector. Worked out from the readings on every read and stored nowhere, for the reason a Package Standing is (ADR-0025). The table is the customer's acceptance contract, transcribed.
_Avoid_: sub-case, scenario, category, ground (which is a Title Document)

**Case Parameters**:
The six figures an Article 8 Provision is decided on: the year the house was built, its storeys above ground, its height from ±0.000, its longest span, the right held over the land and what the land is designated for. Each carries where it came from — read off a sheet, or decided by the kind of Title Document the package carries — and a reading that could not be understood stays beside the figure it failed to give, so a refused reading never looks like a missing one. The year is what a paper says and never what the office declared; a case no paper dates is undecided on the year (ADR-0026).
_Avoid_: attributes, inputs, features

**Title Document**:
A paper confirming the right over the land, which every Article 8 Provision asks for (Article 10.2.1): a state act, a household book extract, a Soviet-era allocation decision, the order allotting the parcel, the register extract. Any one of them answers the requirement. Its kind decides the right it confers — ownership (the register extract, the state act, the 8.0.5 papers) or lease-or-use (everything else, the order allotting the parcel under items 1.4 and 2.7 included) — whatever another paper words; a title of the other class than the provision the case falls under rests on is a finding against the package (ADR-0030). Each is a title only within a window of dates its item of the Decree gives it; one dated outside every window is a finding against the package and decides no right.
_Avoid_: ground document, land document, legal basis (which is what the office declares at intake)

**Document Source**:
Where the policy expects a paper of a Document Type to come from: the envelope, or a state system that confirms it — MQS, the Licences Portal, the Urban Planning Committee, the National Archive. None of the systems is connected. A paper sourced from one is read like any other and reported as read and not confirmed, so reading never passes for confirmation (ADR-0025) — except a paper that prints a QR code, which is put to an Archive QR Check of its own (ADR-0028, ADR-0034).
_Avoid_: integration flag, origin (which is a Field Origin)

**Archive QR Check**:
What became of resolving the QR code decoded off one paper. Made for every type whose schema declares `qr_code` — thirteen of them, the register extract and the plan of the plot among them (ADR-0034). Eleven of those the archive can also be held to line by line: it states its copy and the kind of body that issued it, and the check judges eight lines — Match, Mismatch or NotStated — and, as a fact of its own, whether that body was competent to issue a paper of that kind. An answer may instead be about the sheet: the archive's live service verifies the signature on a certified copy and states nothing about what the paper says. It comes to Confirmed, Differs, NotFound, NoQrCode or IssuerNotConnected, and belongs to the Document, not to the package (ADR-0028, ADR-0034).
_Avoid_: registry check (which is about the property, not a paper)

**QR Code**:
The payload decoded from the symbol printed on a sheet — a link into the service that issued the paper, or a bare reference. Never transcribed and never read off the page: a symbol carries its own error correction, so a payload came back whole or did not come back, and there is no confidence to attach to it (ADR-0034). It is the `qr_code` line of the paper it was found on, and of no other.
_Avoid_: QR reference read off the sheet, QR text

**Supporting Documents**:
No longer part of the language. What papers a case needs beyond its envelope was a table of height bands we invented (ADR-0013); since ADR-0025 it is the Article 8 Provision the case falls under, and the papers it names are papers of the package. Reports written before carry the old finding, and it still reads the way it did.

**Validation Issue**:
A single problem found during verification (missing document, mismatched fields, a paper without the stamp or signature the profile expects of it, low confidence), always tied to the page and field it came from.
_Avoid_: error, violation, warning

**Verification Report**:
The final structured output for a Package: detected documents, extracted fields, and found issues. Input for the inspector, not a legal decision.
_Avoid_: result, summary

**Package Standing**:
What has to happen to a Verification Package next, said in one word for the inspector: it is `Queued`, `UnderVerification`, `Stalled`, `ShortOfDocuments`, `NeedsInspector`, `AwaitingArchiveApproval` or `Cleared`. The third state a reader may call a status and the only one written for a person — the pipeline's `PackageStatus` says where a run got to and the Verification Report's own status says what it found, and `Completed` covers a full envelope and one with seven findings alike. Worked out from those two and from what the archive register was asked, never stored and never set by hand (ADR-0014). It says what is owed, never whether the registration is granted: that is the inspector's.
_Avoid_: status, state, disposition, stage

**Archive Search Approval**:
A person's sign-off on what the archive register answered about a Verification Package: the conclusion the search leads to for the submission as a whole, an optional remark on signing, the moment it was given, and the register's answers as they stood at that moment. A decision about the submission and never about the register, which states what its own fonds hold and judges nothing (ADR-0009). An event and not a field: it covers the state of the archive search it was given, so a run that asks the register again spends it — the record says when it stopped being in force rather than letting a signature stand over answers nobody has read (ADR-0016). It carries no author, because there are no accounts to read one from.
_Avoid_: sign-off, review, decision, sign-off of the register

**Correction**:
An operator stating by hand what one of a Verification Package's papers says, because the scan was poor and the reader got the field wrong or never got it at all. Saved a Document at a time, because an operator fixes a form and saves it; a value replaces whatever was under that key, and no value states that the paper does not say it, which drops the key. It invalidates what rested on the reading it changed and no more (ADR-0036), which is a narrower thing than a file arriving: every Cross-document Check is made again by the run that follows — the whole sweep, because what a paper states decides which papers are compared at all — and until that run replaces them the last verdicts stay readable rather than the checklist going blank; the Registry Checks that rest on the corrected reading are dropped and asked again while the rest are kept; the Archive Search Approval is spent only where one of them was dropped, because an approval ends when the answers it covered stop standing (ADR-0016); and the Verification Report and the edited paper's own Archive QR Check go, while the sheets, the text, the segmentation, the classification and every other paper's readings stay. A correction that states what the package already holds as an operator's own does none of that: it is a no-op, so pressing save twice never re-verifies a package a second time (ADR-0033).
_Avoid_: edit, override, manual entry, fix

**Inspector**:
The human who reviews the Verification Report and makes the actual decision. The system never approves or rejects anything itself.
_Avoid_: user, operator, reviewer
