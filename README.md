# AZ-Cadastre

AI-assisted document verification system for the Real Estate Registration Authority.

## Overview

AZ-Cadastre processes multi-page, multi-format document packages (PDF, JPG, PNG) in multiple languages (Azerbaijani Latin/Cyrillic scripts) with complex validation workflows and human intervention loops. The system provides real-time progress updates to inspectors while maintaining comprehensive audit trails.

## Key Features

- **Multi-Stage Verification Pipeline**: 7-stage orchestrated workflow (classification, OCR, completeness check, cross-validation, legal rules, report generation, human review)
- **Real-Time Updates**: WebSocket-based progress notifications
- **Long-Running Workflows**: Temporal-based orchestration for resumable, auditable processes
- **Structured Data Integration**: PostgreSQL for application data, S3/MinIO for document storage

## Architecture

For detailed architectural decisions and system design, see [ADR-001: Multi-Stage Orchestrated Document Verification Architecture](./docs/ADR/ADR-001.md).

## Project Structure

```
apps/
  web/               # Client-facing UI application
  core/              # Core application logic (API, workflows, services)
libs/
  shared/            # Shared utilities, schemas, API contracts
docs/
  ADR/               # Architectural Decision Records
```

## Getting Started

This is a monorepo project using pnpm workspaces. Run `pnpm install` to set up dependencies.

