# Interop (connector ↔ Upsked)

This tree is the **in-repo placeholder** for the separate connector/interop repository described in [`docs/interop-repo-strategy.md`](../docs/interop-repo-strategy.md). Partner fixtures may live under `fixtures/`; Upsked ships the **verifiers** in `apps/scraper` and `apps/web`.

Upsked is **multi-university**: connectors here are per-school tenants, not a UPD-only pipeline.

## UPLB Los Baños — verify a bundle

From the **repository root**:

```bash
# Default: interop-repo/fixtures/uplb/bundle (override with UPLB_BUNDLE_DIR)
npx tsx interop-repo/scripts/verify-uplb-interop.ts
```

This runs:

1. **Catalog + optional curricula/requisites** — `apps/scraper/scripts/verify-uplb-bundle.ts`  
   Referential checks, canonical `uplb:` ids when `metadata.university_id` is `uplb`, semester consistency, metadata counts.

2. **Curriculum → Upsked `CurriculumBundle`** — `apps/web/scripts/verify-uplb-curriculum-compat.ts`  
   Builds the normalized bundle in memory (`normalize-uplb-from-bundle.ts`): `meta.universityId === 'uplb'`, non-empty `programIndex` / `snapshots`, `uplb:` program summary ids.

**Curriculum validation elsewhere:** ADMU/UPD use `npm run test:curriculum` (graph + placement). UPLB curriculum is validated by the script above (full `CurriculumBundle` build). Ingest **manifest** validation for catalog releases is `validateCanonicalCatalogReleaseManifest` in `apps/web/lib/catalog-ingest-contract.ts` (used by `simulate:ingest`); it does **not** include `curricula.json` today — curriculum artifacts are generated separately (`curriculum:generate` + `UPLB_CATALOG_BUNDLE_DIR`).

### Systems map — what is / is not guaranteed

| Artifact                                                             | Single source of truth in pipeline       | `verify-uplb-bundle`                                                                                                                                             | `verify-uplb-curriculum-compat` |
| -------------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `courses.json`                                                       | `buildCourseIdMaps` + `buildCoursesJson` | ids, titles, duplicates, canonical id for `metadata.university_id`                                                                                               | units lookup for rows           |
| `sections.json` / `schedules.json`                                   | SQLite classes + maps                    | FK to courses, semester = metadata, class_code ↔ schedules                                                                                                       | —                               |
| `curricula.json`                                                     | same maps as courses                     | line count vs metadata; `course_id_canonical` ∈ courses; **namespace** `uplb:` vs `upb:` when `university_id` is uplb; `program_id` ∈ `programs.json` if present | full normalizer                 |
| `course_requisites.json`                                             | cleaned courses + maps                   | row/edge counts vs metadata; FK to courses; namespace                                                                                                            | —                               |
| `programs.json` / `rooms.json` / `institutes.json` / `colleges.json` | optional exports                         | array length vs `metadata.counts.*` when file exists                                                                                                             | —                               |
| `metadata.json`                                                      | emitter                                  | schemaVersion, counts parity                                                                                                                                     | —                               |

**Not validated here:** protobuf ingest, Supabase promotion, room **strings** in schedules vs `rooms.json` GIS rows (schedules use free-text room labels), planner graph solvers, or MCP runtime. Those are separate layers. **Handoff for linking schedules ↔ rooms:** [`fixtures/uplb/HANDOFF-schedules-rooms.md`](./fixtures/uplb/HANDOFF-schedules-rooms.md).

## Live Upsked ingest (any university)

1. Provision DB rows (`universities`, `catalog_sources`, `semesters`) — migration seed, admin **Integrations**, or automated **`POST /api/ingest/v1/tenant/bootstrap`** (see [`docs/partner-tenant-bootstrap.md`](../docs/partner-tenant-bootstrap.md), env `CATALOG_INGEST_TENANT_BOOTSTRAP_SECRET`).
2. Mint an ingest token for the `catalog_sources` row (manifest **`catalogSourceId`** = `source_key`).
3. Build canonical manifest + upload via [`packages/ingest-client`](../packages/ingest-client/) — local dry-run: `cd apps/web && npm run simulate:ingest:uplb` (UPLB interop bundle, `catalogSourceId` **`uplb-interop-bundle`**, semester **`uplb-2025-2`**).
4. Operator **promote** after `staged`. Runtime uses promoted manifest for **any** `universities.id` (see [`docs/catalog-ingest-artifact-strategy.md`](../docs/catalog-ingest-artifact-strategy.md)).

Room linkage note: `verify-uplb-bundle` now emits warning-only `rooms.json` coverage for `schedules.json` labels using heuristic matching, and `npx tsx apps/scraper/scripts/analyze-uplb-room-links.ts [bundleDir]` prints the detailed report. Schedule rows still do not carry a hard room foreign key.

## Fixtures

- `fixtures/uplb/bundle/` — canonical checked-in (or local) **UPLB catalog bundle**; `npm run verify:uplb` uses this by default. Regenerate with `uplb:amis-to-bundle --out interop-repo/fixtures/uplb/bundle`. Override with `UPLB_BUNDLE_DIR` / `INGEST_SIM_BUNDLE_DIR` when needed.
- UP Baguio sample paths referenced in the app: `fixtures/upb/sample-upsked-bundle` (clone from SDK when available).
