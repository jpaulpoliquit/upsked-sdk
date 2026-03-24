# UPSked SDK

**If you are building a university connector** so your school’s catalog can plug into UPSked, this repository is your contract and tooling. You do **not** need the main UPSked app repo to validate a release bundle.

## What you build

1. **Extract** course/section/schedule data from your source (portal, API, export).
2. **Normalize** it into this SDK’s canonical row types (`packages/schema`).
3. **Emit** a single **release bundle** directory: JSON + `manifest.json` (hashes, `releaseId`).
4. **Run the verifier** (`packages/verifier-sdk`) until it reports **zero errors**. That bundle is what you hand to UPSked for ingest when the integration is wired.

The UP Baguio (**UPB**) material under `connectors/upb/` and `fixtures/upb/` is a **reference pipeline** (AMIS → normalized JSON → interop rows), not a requirement to copy file-for-file.

## Where to read next

| You want to…                                                          | Open                                                   |
| --------------------------------------------------------------------- | ------------------------------------------------------ |
| **End-to-end steps, contracts, and definition of done**               | [docs/CONTRIBUTOR_GUIDE.md](docs/CONTRIBUTOR_GUIDE.md) |
| **Short checklist** (same rules, less prose)                          | [docs/connector-spec.md](docs/connector-spec.md)       |
| **How this maps to code paths inside the main UPSked app** (optional) | [docs/UPSTREAM_LINKS.md](docs/UPSTREAM_LINKS.md)       |
| **PRs and CI on this repo**                                           | [CONTRIBUTING.md](CONTRIBUTING.md)                     |
| **Security disclosures**                                              | [SECURITY.md](SECURITY.md)                             |

## Repository layout

```text
upsked-sdk/
  packages/schema/       # Types + validators for rows and manifest (your contract)
  packages/verifier-sdk/ # CLI: verify a bundle, optional regression vs previous release
  connectors/<id>/       # Example or partner-owned extract/normalize scripts
  fixtures/<id>/         # Sample bundles for tests and documentation
  docs/                  # Specs and contributor guides
```

## What UPSked owns vs what you own

| You (connector author)                                               | UPSked (product)                                    |
| -------------------------------------------------------------------- | --------------------------------------------------- |
| Extractor, rate limits, credentials outside git                      | Ingest APIs, promotion, storage                     |
| Canonical bundle on disk + verifier clean report                     | Runtime manifest, app fetch paths, serving to users |
| Stable `universityId`, `connectorId`, `connectorVersion` in metadata | Wiring your bundle into production when ready       |

## Commands (from repo root)

- `npm run verify -- <bundleDir> [--previous <dir>]` — verify **your** bundle; fix all errors before handoff.
- `npm run verify:sample` — runs the small UPB sample in `fixtures/upb/` (sanity check that your checkout works).
- `npm run fixtures:sync` — regenerates `manifest.json` for fixture dirs that use `fixture.config.json` (see `fixtures/README.md`).
- `npm run test` — verifier tests against repo fixtures.
- `npm run ci` — same checks as GitHub Actions (lint, format, typecheck, test, `verify:sample`).

## Packages (for integrators)

- **`packages/schema`** — `CourseRow`, `SectionRow`, `ScheduleRow`, manifest types, validators.
- **`packages/verifier-sdk`** — semantic checks, hashing, regression vs `--previous`, report output.
- **`scripts/sync-fixture-manifests.ts`** — used to rebuild fixture manifests after editing row JSON in this repo.
