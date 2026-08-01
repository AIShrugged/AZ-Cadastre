# AZ-Cadastre — Document Verification

AI-assisted verification of document packages submitted for government registration (target domain: cadastre; the mechanism is domain-agnostic). The system prepares a verification report; the legal decision is always made by a human inspector.

## Language

**Verification Package**:
A set of files uploaded together for one verification. The unit the inspector works with.
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
A single structured value pulled from a Document: value + confidence + page reference.
_Avoid_: attribute, property

**Verification Profile**:
A declarative definition of what a valid Package looks like: which Document Types exist, their field schemas, which documents are required, and the cross-document rules. Domains (cadastre, …) are expressed as profiles; the engine only interprets them.
_Avoid_: ruleset, config, template

**Validation Issue**:
A single problem found during verification (missing document, mismatched fields, expired document, low confidence), always tied to the page and field it came from.
_Avoid_: error, violation, warning

**Verification Report**:
The final structured output for a Package: detected documents, extracted fields, and found issues. Input for the inspector, not a legal decision.
_Avoid_: result, summary

**Inspector**:
The human who reviews the Verification Report and makes the actual decision. The system never approves or rejects anything itself.
_Avoid_: user, operator, reviewer
