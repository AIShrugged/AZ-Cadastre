# Verification Profiles instead of hardcoded rules

Document types, field schemas, required-document lists, and cross-document rules are declared in a Verification Profile — a TypeScript object in the domain layer of `apps/core` (see ADR-0004) — interpreted by a generic validation engine. The PRD's original hardcoded rules were rejected because the target domain (cadastre, later others) must be added without touching the engine; the original rental-application rules were only ever a placeholder. Profiles live in code, not in the database: for the MVP, an admin UI, migrations, and profile versioning are overkill.

The MVP ships with a single demo profile (Passport + Driver License + Application) exercising every rule kind: required documents, cross-document field equality, expiration, and confidence threshold.
