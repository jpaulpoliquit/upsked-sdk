# Connector author guide — UPSked SDK

**Audience:** teams building a **school-specific connector** (scraper, browser script, API client, or batch export) so UPSked can consume their catalog. You implement extraction and normalization; UPSked implements ingest, promotion, and product UI.

**Read this document before** you assume a database schema, Supabase row, or “push to production” step exists. **v0 handoff** is a **verified release bundle** on disk (JSON + `manifest.json`), not a live write to UPSked.

---

## 1. Scope

| In scope                                                          | Out of scope                              |
| ----------------------------------------------------------------- | ----------------------------------------- |
| Canonical **row shapes** + on-disk **bundle** (`packages/schema`) | Postgres, RLS, direct writes to UPSked DB |
| **Verification** (`packages/verifier-sdk`)                        | Serving catalogs to end users             |
| **Fixtures** + local CI                                           | Secrets, session tokens, raw HARs in git  |

**Definition of done (today):** `npm run verify -- <your-bundle>` exits **0** with **zero verifier errors**, and you can hand the directory to UPSked under the agreed ingest path. **Not required yet:** automated upload, Supabase row, or promotion job.

---

## 2. Two contracts (do not confuse them)

UPSked carries **two** manifest shapes on purpose:

|                   | **Partner bundle** (this repo)                                                   | **Runtime manifest** (`catalog-release-manifest` in main app)    |
| ----------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Purpose**       | Immutable files + hashes for ingest / audit                                      | Browser resolves “what to fetch next” (`getCourseCatalog`, etc.) |
| **Artifact refs** | Required `key`, `sha256`, `sizeBytes`, `contentType` per file                    | Often `method` + `path` to **API routes**; `sha256` optional     |
| **Source types**  | `scraper`, `official_api`, `partner_connector`, `managed_import`, `local_bundle` | Above **plus** `supabase_storage` (generated PBF in Storage)     |
| **Extra kinds**   | `raw_payload_index_json`                                                         | Legacy **`catalog_json`**, **`search_index`**                    |
| **Identity**      | `catalogSourceId`, `connectorId`, `connectorVersion`, `trustTier`                | Not required on wire today                                       |
| **Strict Zod**    | `catalog-ingest-contract.ts` (ingest + verifier report types)                    | Parsed with `parseCatalogReleaseManifest` in app                 |

**Rule:** implement the **partner bundle** shape in this repo and run the **verifier** locally. The main app’s `getCatalogManifest` is a **runtime adapter** for already-promoted data; it does **not** replace your obligation to produce a verifier-clean partner bundle.

**UP Baguio:** use `semesterId` `upb-{AY_START}-{term}` (not Diliman CRS numeric ids). Every row in `sections.json` must match the manifest `semesterId`. See [`docs/upb-catalog-semester-id.md`](./upb-catalog-semester-id.md).

---

## 3. Work order (what you should do)

1. **Extract** — Raw payloads (HTML, JSON, export). Keep provenance: URL, date, portal version.
2. **Normalize** — Map to **one** place: `CourseRow` / `SectionRow` / `ScheduleRow` in `packages/schema/src/index.ts`. **Never** “fix” IDs by patching inside the verifier; fix your mapping.
3. **Write JSON** — `courses.json` (or `courses.pbf`), `sections.json`, `schedules.json`, `metadata.json` into a single **bundle directory** (§5).
4. **Build manifest** — `buildManifestFromLocalArtifacts` + `fixture.config.json`, or `npm run fixtures:sync` for fixtures. Do not hand-edit hashes.
5. **Verify** — `npm run verify -- <bundleDir> [--previous <dir>]` (§8). **Errors block handoff.**
6. **Regression** — When the semester already had an accepted release, pass that directory as `--previous` and fix any regression failures.
7. **Handoff** — Deliver the bundle (and verifier report if requested) to UPSked through the channel they specify. **Automated ingest** may arrive later; your bundle must still match this contract.

---

## 4. Definition of done (your connector)

- [ ] All **required** JSON files present (§5); `metadata.json` matches manifest connector fields.
- [ ] `npm run verify` exits **0**; **0** verifier errors (warnings follow trust-tier / ops policy; do not ignore errors).
- [ ] `releaseId` is **content-derived** (interop builder + `hash.ts`); not a random string.
- [ ] **No** secrets in repo; fixtures **redacted**.
- [ ] **Regression** run when you have a prior accepted bundle for that semester (`--previous`).
- [ ] Documented **rate limits** and **failure** behavior for the extractor (see `ops-model.md`).

---

## 5. Bundle layout

**Verifier reads `manifest.json` only** at the bundle root.

| File                                | Required                    |
| ----------------------------------- | --------------------------- |
| `manifest.json`                     | Yes                         |
| `courses.json` **or** `courses.pbf` | Yes (see §6 for PBF caveat) |
| `sections.json`                     | Yes                         |
| `schedules.json`                    | Yes                         |
| `metadata.json`                     | Yes                         |

Optional: `programs.json`, `rooms.json`, `raw_payload_index.json`.  
`validation_report.json` is typically **output** from the verifier CLI (`--out`).

`manifest.generated.json` is optional for human diffs; verification uses **`manifest.json`**. The UPB sample script writes both from the same build.

---

## 6. Row model & validation

**Source of truth:** `packages/schema/src/index.ts`.

| Layer                | What it checks                                                                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Schema**           | `validateManifest`, `validateCourseRows`, … — shape, enums, required fields                                                                        |
| **Verifier**         | Orphans, time ranges, hash mismatch, `releaseId` recompute, regression % vs previous bundle                                                        |
| **PBF-only courses** | Verifier **does not** decode protobuf; it warns (`courses_pbf_deep_validation_skipped`). Ship **`courses.json`** whenever possible for full gates. |
| **Programs / rooms** | Kinds exist; **row-level** validation may be incomplete — do not ship empty files with bogus counts.                                               |

Bump **`SCHEMA_VERSION`** in schema when you break row shapes; keep `manifest.schemaVersion` in sync.

---

## 7. Extractors (“scrapers”)

| Mode                  | When                                                                     |
| --------------------- | ------------------------------------------------------------------------ |
| **Browser + session** | SPA + `fetch` with cookies / `x-session-id` — common for campus portals. |
| **Headless**          | Repeatable runs; needs test account + secrets outside git.               |
| **Server cron**       | Only if IT gives stable API credentials.                                 |

**Rules:** respect rate limits; sequential or bounded concurrency; version your connector (`metadata.json` / manifest); never commit live sessions.

---

## 8. Commands (repo root, e.g. `upsked-sdk/`)

| Command                                                             | Purpose                                                     |
| ------------------------------------------------------------------- | ----------------------------------------------------------- |
| `npm install`                                                       | Installs `typescript`, `tsx`, workspaces                    |
| `npm run typecheck`                                                 | Project typecheck                                           |
| `npm run test`                                                      | Verifier E2E on fixtures                                    |
| `npm run verify -- <bundle> [--previous <dir>] [--out report.json]` | **General** verify                                          |
| `npm run verify:sample`                                             | UPB sample + regression                                     |
| `npm run fixtures:sync`                                             | Regenerate fixture manifests from JSON + config             |
| `npm run lint`                                                      | ESLint (`packages/`, `scripts/`, `connectors/`)             |
| `npm run format` / `npm run format:check`                           | Prettier (repo root; `fixtures/` ignored)                   |
| `npm run ci`                                                        | Full gate: lint + format + typecheck + test + sample verify |

**Example:**  
`npm run verify -- ./fixtures/upb/sample-release --previous ./fixtures/upb/previous-release`

**Connector sample:** `connectors/upb/src/verify-release.ts` — build manifest → write `manifest.json` → verify → optional `report.generated.json`.

---

## 9. Fixtures

Under `fixtures/<university>/<bundle>/`. See `fixtures/README.md`.  
Flow: edit JSON → `fixtures:sync` → `npm run test` → commit.

---

## 10. How this connects to the UPSked app (expectations)

You do **not** need the main app repo to finish a connector. When you are ready to align with product code paths, see [UPSTREAM_LINKS.md](./UPSTREAM_LINKS.md).

| Piece                          | Role                                                                                   |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| `POST /api/getCatalogManifest` | Returns **runtime** `CatalogReleaseManifest` for `upd` / `admu` / `upb` adapters       |
| `catalog-client.ts`            | Manifest-first load; IndexedDB key includes **`releaseId`** when present               |
| `catalog-ingest-contract.ts`   | **Target** shape for partner submissions; **not** enforced on `getCatalogManifest` yet |

Your bundle should remain valid when ingest enforces `validateCanonicalCatalogReleaseManifest`.

---

## 11. Known gaps (plan around these)

- Ingest **control plane** (tables, tokens, upload API) — **not** in this repo; connector authors still ship verifier-clean bundles.
- Verifier **PBF** decode — not implemented; prefer `courses.json` for full gates.
- **Programs/rooms** — deep row checks may lag; counts vs files must still match manifest rules in `catalog-ingest-contract` when ingest is on.
- **Runtime vs partner** `sourceType` — use partner enum for new work; runtime may list `supabase_storage` until unified.

---

## 12. Further reading

| Doc                                        |                                                                   |
| ------------------------------------------ | ----------------------------------------------------------------- |
| [connector-spec.md](./connector-spec.md)   | Checklist                                                         |
| [validation-spec.md](./validation-spec.md) | Layer definitions                                                 |
| [ops-model.md](./ops-model.md)             | Cadence / ownership                                               |
| [../README.md](../README.md)               | Package map                                                       |
| [UPSTREAM_LINKS.md](./UPSTREAM_LINKS.md)   | Main UPSked repo paths (ingest contract, `getCatalogManifest`, …) |
| [../CONTRIBUTING.md](../CONTRIBUTING.md)   | PR checklist (lint, format, CI)                                   |
| [../SECURITY.md](../SECURITY.md)           | Vulnerability reporting                                           |

---

_Bump this doc when `SCHEMA_VERSION` (`packages/schema`) or `VERIFIER_VERSION` (`verifier.ts`) changes._
