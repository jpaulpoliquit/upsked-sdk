# Schema Package

Owns the canonical schemas for:

- release manifest
- artifact metadata
- courses
- sections
- schedules
- metadata
- issue objects used by verifier reporting

The package is intentionally runtime-light. It exposes TypeScript types plus deterministic validation helpers that connector CI and the Upsked ingest plane can both run against the same release bundle.
