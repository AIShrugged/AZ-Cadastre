# AZ-Cadastre — Document Verification

AI-assisted verification of document packages submitted for government registration (target domain: cadastre; the mechanism is domain-agnostic). The system prepares a verification report; the legal decision is always made by a human inspector.

## Language

**Verification Package**:
A set of files uploaded together for one verification. The unit the inspector works with.
_Avoid_: submission, case, batch

**Document**:
One uploaded file, treated as exactly one logical document. Mixed-content files (e.g. a PDF containing a passport and a licence) are out of scope.
_Avoid_: file, scan, attachment (when meaning the logical document)

**Page**:
A single image derived from a Document (one per PDF page; an image file is one Page). The unit sent to OCR.

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
