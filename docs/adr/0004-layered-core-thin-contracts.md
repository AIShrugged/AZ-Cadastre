# Four-layered core, thin contracts package

`apps/core` follows a 4-layer architecture: **api** (controllers, DTO mapping), **application** (use cases / pipeline stages, port declarations), **domain** (entities, Verification Profiles, validation engine — pure logic, no framework), **infrastructure** (DB repositories, port adapters, mocks).

`libs/contracts` (`@cadastre/contracts`) holds **only zod schemas for the API DTOs** shared between web and core. The domain model never leaks into contracts: it's tempting to put domain types there for reuse, but that couples the frontend to internal representations and freezes the domain model behind a published contract. The api layer maps domain objects to DTOs explicitly.
