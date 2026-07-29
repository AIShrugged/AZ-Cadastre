# Four-layered core, thin contracts package

> Partly superseded by [ADR-0005](./0005-bounded-context-packages.md): the four layers stand, but they now live in a package per bounded context (`libs/contexts/verification/`) rather than directly under `apps/core`, which is a composition root. What this ADR says about `libs/contracts` is unchanged.

`apps/core` follows a 4-layer architecture: **api** (controllers, DTO mapping), **application** (use cases / pipeline stages, port declarations), **domain** (entities, Verification Profiles, validation engine — pure logic, no framework), **infrastructure** (DB repositories, port adapters, mocks).

`libs/contracts` (`@cadastre/contracts`) holds **only zod schemas for the API DTOs** shared between web and core. The domain model never leaks into contracts: it's tempting to put domain types there for reuse, but that couples the frontend to internal representations and freezes the domain model behind a published contract. The api layer maps domain objects to DTOs explicitly.
