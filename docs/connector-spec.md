# Connector Spec

For the full narrative (two contracts, artifacts, scrapers, work order, definition of done), see **[CONTRIBUTOR_GUIDE.md](./CONTRIBUTOR_GUIDE.md)**. Below: minimal checklist.

## Goal

Each connector turns a school-specific source system into one canonical UPSked **release bundle** (directory of JSON + `manifest.json`).

## Required steps

1. Extract raw payloads from the source system.
2. Normalize into canonical row types (`packages/schema`).
3. Emit JSON files + `metadata.json`.
4. Build `manifest.json` (hashes + `releaseId` — use `buildManifestFromLocalArtifacts`, do not hand-roll).
5. Run `npm run verify -- <bundle> [--previous <dir>]`; exit non-zero on errors.
6. Keep a previous-bundle fixture for regression when the semester is unchanged.
7. Later: submit the immutable bundle to UPSked ingest (when API exists).

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

Align with `canonicalCatalogReleaseManifestSchema` in the main UPSked app (`catalog-ingest-contract.ts`) — see [UPSTREAM_LINKS.md](./UPSTREAM_LINKS.md) (single source for future ingest):

- `universityId`, `semesterId`, `releaseId`, `schemaVersion`
- `sourceType`, `catalogSourceId`, `connectorId`, `connectorVersion`, `trustTier`
- `publishedAt`, `counts`, `artifacts` (each with `sha256`, `sizeBytes`, …)

## Invariants

- `releaseId` is immutable and **content-derived** (interop `hash.ts`).
- Artifact list + hashes match bytes on disk.
- Every section references a course; every schedule references a section/class code.
- IDs stable within `universityId` + source.
- Connector only emits its **assigned** `universityId`.

## CI minimum

- `npm run typecheck`
- `npm run test` (fixture verifier)
- `npm run verify` on the connector’s sample bundle with `--previous` when applicable
