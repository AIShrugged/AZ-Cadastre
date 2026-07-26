# AZ-Cadastre

AI-assisted document verification system for the Real Estate Registration Authority.

## Overview

AZ-Cadastre processes multi-page, multi-format document packages (PDF, JPG, PNG) in multiple languages (Azerbaijani Latin/Cyrillic scripts) with complex validation workflows and human intervention loops. The system provides real-time progress updates to inspectors while maintaining comprehensive audit trails.

## Key Features

- **Multi-Stage Verification Pipeline**: 7-stage orchestrated workflow (classification, OCR, completeness check, cross-validation, legal rules, report generation, human review)
- **Real-Time Updates**: WebSocket-based progress notifications
- **Long-Running Workflows**: Temporal-based orchestration for resumable, auditable processes
- **Structured Data Integration**: PostgreSQL for application data, RustFS (S3-compatible) for document storage

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

## Docker

Build and run the application in Docker:

```bash
# Build frontend from repository root
docker build -f apps/web/Dockerfile -t frontend-app .

# Build backend from repository root
docker build -f apps/core/Dockerfile -t core-app .

# Run with docker-compose (includes frontend, backend, and database)
docker compose up --build
```

See [docs/DOCKER.md](docs/DOCKER.md) for detailed Docker setup and deployment instructions.
