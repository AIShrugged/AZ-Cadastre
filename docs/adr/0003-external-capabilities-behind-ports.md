# External capabilities behind abstract-class ports

OCR, document classification, field extraction, and object storage are consumed through NestJS abstract-class ports (`OcrProvider`, `DocumentClassifier`, `FieldExtractor`, `ObjectStorage`). The MVP ships mock implementations wired via DI; real adapters (a cloud OCR engine, an LLM for classification/extraction, an S3-compatible store) are added separately without touching the pipeline.

Classification and extraction operate on OCR *text*, not page images. This fixes the pipeline order to OCR → Classify → Extract (the order in PRD section 2); the PRD's original section 7 table had classification before OCR, which would require a vision model, and was corrected.
