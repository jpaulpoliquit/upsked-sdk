# Upsked SDK

Build a university connector so your school's catalog plugs into Upsked. You don't need the main app repo to validate a release bundle.

Upsked is **multi-university** — the same contract works for UPD, UPLB, UPB, ADMU, DLSU, and any future school.

## What you build

1. **Extract** course, section, and schedule data from your source system (portal, API, export).
2. **Normalize** into canonical row types from `packages/schema` (`CourseRow`, `SectionRow`, `ScheduleRow`, …).
3. **Emit** a release bundle directory: JSON files + `manifest.json` (content-derived hashes, `releaseId`).
4. **Verify** with `npm run verify -- <bundle>` until it reports **zero errors**.

That bundle is what you hand to Upsked for ingest. The UPB connector under `connectors/upb/` is a reference pipeline (AMIS → normalized JSON → interop rows), not something you need to copy.

## Quick start

```bash
git clone <this-repo> && cd upsked-sdk
npm install
npm run ci          # lint, format, typecheck, test, verify:sample
```

## Commands

| Command                                      | What it does                                              |
| -------------------------------------------- | --------------------------------------------------------- |
| `npm run verify -- <dir> [--previous <dir>]` | Verify your bundle. Fix all errors before handoff.        |
| `npm run verify:sample`                      | Runs the UPB sample fixture (sanity check your checkout). |
| `npm run fixtures:sync`                      | Regenerate `manifest.json` for fixtures with config.      |
| `npm run test`                               | Verifier tests against repo fixtures.                     |
| `npm run ci`                                 | Full gate — same checks as GitHub Actions.                |
| `npm run typecheck`                          | TypeScript project check.                                 |
| `npm run lint` / `npm run format:check`      | ESLint + Prettier.                                        |

## Repository layout

```
upsked-sdk/
├── packages/
│   ├── schema/            # Row types, manifest types, validators (your contract)
│   └── verifier-sdk/      # CLI verifier, regression diffing, report generation
├── connectors/
│   └── upb/               # Reference: UPB AMIS → Upsked bundle pipeline
├── fixtures/
│   ├── upb/               # UPB sample + previous release for regression
│   ├── uplb/              # UPLB catalog bundle
│   └── dlsu/              # DLSU fixtures
├── docs/                  # Specs and contributor guides
└── scripts/               # Fixture sync, cross-school verification helpers
```

## What you own vs what Upsked owns

| You (connector author)                                   | Upsked (product)                                    |
| -------------------------------------------------------- | --------------------------------------------------- |
| Extractor, rate limits, credentials (outside git)        | Ingest APIs, promotion, storage                     |
| Canonical bundle on disk + clean verifier report         | Runtime manifest, app fetch paths, serving to users |
| Stable `universityId`, `connectorId`, `connectorVersion` | Wiring your bundle into production when ready       |

## Where to read next

| You want to…                                       | Open                                                   |
| -------------------------------------------------- | ------------------------------------------------------ |
| Full walkthrough, contracts, definition of done    | [docs/CONTRIBUTOR_GUIDE.md](docs/CONTRIBUTOR_GUIDE.md) |
| Short checklist (same rules, less prose)           | [docs/connector-spec.md](docs/connector-spec.md)       |
| Validation layers and result types                 | [docs/validation-spec.md](docs/validation-spec.md)     |
| Ops model (trust tiers, cadence, failure handling) | [docs/ops-model.md](docs/ops-model.md)                 |
| Code paths in the main Upsked app (optional)       | [docs/UPSTREAM_LINKS.md](docs/UPSTREAM_LINKS.md)       |
| PRs and CI on this repo                            | [CONTRIBUTING.md](CONTRIBUTING.md)                     |
| Security disclosures                               | [SECURITY.md](SECURITY.md)                             |

## Getting an ingest token

You **don't** need an ingest token to build or verify bundles locally. You need one when your workflow moves from _verified bundle on disk_ to _submit via Upsked's hosted ingest API_.

The token is the credential your connector uses to create ingest runs, upload artifacts, and submit manifests. It is **not** a replacement for your source-system credentials, and it has nothing to do with production promotion (that's handled by Upsked operators).

To get one:

1. Ask to be added to the **integrators list**.
2. Sign in at [upsked.com](https://upsked.com) → **Account Settings** → **Ingest API**.
3. Generate or copy your token.

If you don't see **Ingest API** in settings, your account hasn't been added yet — reach out at `john@upsked.com`.

## Packages

- **`packages/schema`** — `CourseRow`, `SectionRow`, `ScheduleRow`, manifest types, validators. Runtime-light: types + deterministic validation only.
- **`packages/verifier-sdk`** — Semantic checks, content hashing, regression diffing vs `--previous`, report generation. The narrow acceptance contract — nothing reaches Upsked runtime until this package accepts the bundle.

## Fixtures

Under `fixtures/<university>/`. Edit JSON → `npm run fixtures:sync` → `npm run test` → commit.

See [`fixtures/README.md`](fixtures/README.md) for layout details and per-school notes.
