# UP Baguio (UPB) connector (reference implementation)

**Not every school uses AMIS.** This folder is a **worked example** for **UPB**: raw AMIS exports → intermediate UPSked-shaped JSON → canonical interop rows + manifest. If you build another university’s connector, copy the **pattern** (extract → normalize → verify), not necessarily these scripts.

This code does **not** write to UPSked production databases. A verified bundle is produced on disk; ingest into UPSked follows product process.

**Before you read further:** generic rules for **any** connector live in [docs/CONTRIBUTOR_GUIDE.md](../../docs/CONTRIBUTOR_GUIDE.md) and [docs/connector-spec.md](../../docs/connector-spec.md).

## Layout

| Path                         | Role                                                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------------------- |
| `pipeline/`                  | Node scripts (merge pages, HAR extract, clean to UPSked shape, export camelCase rows for verifier) |
| `pipeline/lib/`              | `upb-amis-transform`, `upb-amis-clean-upsked`                                                      |
| `extract-classes-browser.js` | Paste in browser on your campus AMIS (e.g. `amis.upb.edu.ph`; session + paginated fetch)           |
| `src/verify-release.ts`      | Build manifest + run verifier vs `fixtures/upb/previous-release`                                   |

## Fixtures (repo root)

| Path                                           | Role                                                                  |
| ---------------------------------------------- | --------------------------------------------------------------------- |
| `fixtures/upb/sample-amis-classes-merged.json` | Merged AMIS `classes` API export                                      |
| `fixtures/upb/sample-upsked-bundle/`           | AISIS-style JSON (`sections-upsked.json`, …) for the web app / PBF    |
| `fixtures/upb/sample-release/`                 | **Tiny** verifier bundle for CI + `fixture.config.json`               |
| `fixtures/upb/full-upb-2025-2-interop/`        | Full real export (camelCase); default output of `amis:export-interop` |
| `fixtures/upb/previous-release/`               | Smaller bundle for regression checks                                  |

## Typical flow

1. Capture paginated `classes` JSON from AMIS (or use the browser extractor).
2. `npm run amis:pages -- path/to/page1.json path/to/page2.json` (from `connectors/upb/`) → writes `fixtures/upb/sample-amis-classes-merged.json`.
3. Optional: paginated `courses-only-*.json` + `all-programs*.json` from AMIS → pass to `amis:clean` with `--courses-page` / `--programs`.
4. `npm run amis:clean` → `fixtures/upb/sample-upsked-bundle/`.
5. `npm run amis:export-interop` → writes camelCase JSON to `fixtures/upb/full-upb-2025-2-interop/` (does not touch the tiny `sample-release/` used in CI).

Semester slug convention: [`docs/upb-catalog-semester-id.md`](../../docs/upb-catalog-semester-id.md).
6. From **this repo root**: `npm run fixtures:sync` only updates `previous-release` + `sample-release` manifests; `npm run verify:sample` checks those.

## Monorepo note

When nested as `up-scheduler/interop-repo`, the Next app checks `interop-repo/fixtures/upb/sample-upsked-bundle` before `output/upb-amis-upsked`.
