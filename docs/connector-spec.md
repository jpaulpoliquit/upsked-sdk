# Connector spec (checklist)

**Who this is for:** anyone implementing a **new school connector** that must interoperate with Upsked. Follow this checklist while you build; use **[CONTRIBUTOR_GUIDE.md](./CONTRIBUTOR_GUIDE.md)** for the full explanation, edge cases, and commands.

**Product scope:** Upsked is **multi-university** (not UPD-only). Each connector targets one school’s source system and its tenant / `university_id` in ingest.

**Outcome:** one **release bundle** per drop that passes `npm run verify -- <bundle>` with **zero errors**.

## Goal

Turn your school’s source system (portal, API, files) into one canonical Upsked **release bundle**: a directory of JSON files + `manifest.json` that the verifier in this SDK accepts.

## Required steps

1. Extract raw payloads from the source system (keep provenance notes for your own ops; do not commit secrets).
2. Normalize into canonical row types defined in `packages/schema` (`CourseRow`, `SectionRow`, `ScheduleRow`, …).
3. Emit `courses.json` (or `courses.pbf`), `sections.json`, `schedules.json`, `metadata.json` into **one** directory.
4. Build `manifest.json` using `buildManifestFromLocalArtifacts` (or your connector’s wrapper). **Do not** hand-edit hashes or `releaseId`.
5. Run `npm run verify -- <bundle> [--previous <dir>]`. Fix every error before handoff.
6. When the same semester already had an accepted release, keep a copy of that bundle and pass it as `--previous` for regression checks.
7. Deliver the bundle to Upsked through their agreed channel. **Upload APIs** may come later; the on-disk contract stays the same.

## Required release bundle

- `manifest.json`
- `courses.json` or `courses.pbf` (prefer JSON for full verification)
- `sections.json`
- `schedules.json`
- `metadata.json`

Optional:

- `programs.json`
- `rooms.json`
- `raw_payload_index.json`
- `validation_report.json` (usually verifier **output**)

## Required manifest fields

Stay aligned with `canonicalCatalogReleaseManifestSchema` in the main Upsked app (`catalog-ingest-contract.ts`) — see [UPSTREAM_LINKS.md](./UPSTREAM_LINKS.md):

- `universityId`, `semesterId`, `releaseId`, `schemaVersion`
- `sourceType`, `catalogSourceId`, `connectorId`, `connectorVersion`, `trustTier`
- `publishedAt`, `counts`, `artifacts` (each with `sha256`, `sizeBytes`, …)

## Invariants

- `releaseId` is immutable and **content-derived** (interop `hash.ts`).
- Artifact list + hashes match bytes on disk.
- Every section references a course; every schedule references a section/class code.
- IDs stable within `universityId` + source.
- Connector only emits its **assigned** `universityId`.

## CI minimum (when contributing to this SDK repo)

- `npm run typecheck`
- `npm run test` (fixture verifier)
- `npm run verify` on the connector’s sample bundle with `--previous` when applicable
