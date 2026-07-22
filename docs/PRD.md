# MVP — AI Document Verification System

## 1. Goal

Build an MVP of an AI-assisted document verification system for government real estate registration.

**The system does not make legal decisions.**

Its purpose is to help an inspector quickly verify submitted document packages by:

- collecting uploaded documents
- recognizing document types
- extracting structured data
- validating completeness
- checking consistency between documents
- producing a verification report

The final approval is always performed by a human inspector.

## 2. Scope

The MVP focuses on a single verification flow:

```
Upload Package
      ↓
Store files
      ↓
Split PDFs into pages
      ↓
OCR
      ↓
Document Classification
      ↓
Field Extraction
      ↓
Validation
      ↓
Verification Report
```

Human review workflows, notifications and advanced orchestration are intentionally left outside the MVP.

## 3. Supported Input

### File formats

- PDF
- JPG
- JPEG
- PNG

### Upload

A verification package may contain multiple files.

Example:

```
package/
├── passport.pdf
├── driver_license.jpg
└── application.pdf
```

## 4. Functional Requirements

### 4.1 Upload Package

User uploads one or more files.

Backend should:

- create Verification Package
- upload originals to S3
- store metadata in PostgreSQL
- create Temporal workflow

### 4.2 PDF Processing

Every PDF is automatically split into pages. Each page becomes an individual image for OCR.

Example:

```
passport.pdf
      ↓
page_1.png
page_2.png
```

### 4.3 OCR

Each page is sent to a third-party OCR provider.

The OCR provider returns:

- recognized text
- bounding boxes (optional)
- confidence score

The backend stores OCR results.

### 4.4 Document Classification

Each processed document is classified.

Supported document types:

- Passport
- Driver License
- Rental Application
- Unknown

Example:

```
page → Passport
```

### 4.5 Field Extraction

Depending on the detected document type, the system extracts structured fields.

**Passport** — example fields:

- First Name
- Last Name
- Date of Birth
- Passport Number
- Expiration Date

**Driver License** — example fields:

- First Name
- Last Name
- License Number
- Expiration Date

**Rental Application** — example fields:

- Applicant Name
- Passport Number
- Driver License Number

Each extracted field stores:

- value
- confidence
- page number

### 4.6 Validation

The backend performs simple hardcoded validation rules.

#### Required documents

Rental application requires:

- Passport
- Driver License

Missing documents should be reported.

#### Cross-document validation

Examples:

| Document       | Field           |            | Document           | Field                 |
| -------------- | --------------- | ---------- | ------------------ | --------------------- |
| Passport       | First Name      | must equal | Driver License     | First Name            |
| Passport       | Last Name       | must equal | Driver License     | Last Name             |
| Passport       | Passport Number | must equal | Rental Application | Passport Number       |
| Driver License | License Number  | must equal | Rental Application | Driver License Number |

#### Expiration validation

Check:

- passport expiration
- driver license expiration

#### OCR confidence

Fields below a configured confidence threshold should be flagged.

Example:

```
confidence < 0.80 → Needs review
```

## 5. Verification Report

The final output is a structured report.

Overall status:

- OK
- Issues Found
- Incomplete Package

Report contains:

- detected documents
- extracted fields
- validation errors
- missing documents
- mismatched values
- OCR confidence
- page references

Example:

```
Status
  Issues Found
---
Missing Documents
  None
---
Validation
  Passport Name != Driver License Name
  Page 1
  Confidence 0.92
---
Expired Documents
  Driver License
---
Low Confidence
  Passport Number
  Confidence 0.61
```

## 6. User Interface

### Dashboard

Displays verification packages.

Columns:

- Package ID
- Created At
- Status
- Progress

### Upload Page

User can:

- upload files
- create package
- start verification

### Verification Details

Shows:

```
Uploaded documents
      ↓
OCR result
      ↓
Extracted fields
      ↓
Validation report
```

Each issue links to:

- page
- field
- confidence
