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

## Getting an ingest token

You do **not** need an ingest token to build or verify a bundle locally.

You **do** need one once your handoff path uses the hosted UPSked ingest flow on **upsked.com**.

### What the ingest token is for

The ingest token is the **credential your connector uses to talk to UPSked’s hosted ingest API**.

In practice, that means the token is used when your integration needs to do things like:

- create an ingest run for a release
- upload release artifacts
- submit the release manifest
- ask UPSked to validate what you uploaded

Without the token, UPSked has no way to know that your connector is allowed to send a release into that ingest pipeline.

### What the ingest token is not for

- It is **not** needed for local extraction, normalization, manifest building, or verifier runs inside `upsked-sdk`.
- It is **not** a replacement for your source-system credentials. You still need whatever access is required to fetch data from your university system.
- It is **not** the same thing as production promotion. Connector authors usually use the token to submit data into the ingest flow; deployment-side promotion is handled separately by UPSked operators.

### When you actually need it

You need the token when your workflow moves from:

`verified bundle on disk`

to:

`send this bundle to UPSked's hosted ingest API`

If your current handoff is still manual or out-of-band, you may not need the token yet.

1. Ask to be added to the **integrators list**.
2. After that is enabled on your account, sign in to **[upsked.com](https://upsked.com)**.
3. Open **Account Settings**.
4. Open **Ingest API**.
5. Generate or copy your ingest token key there.

If you do **not** see the **Ingest API** section in Account Settings yet, your account probably has not been added to the integrators list. Reach out at `john@upsked.com`.

## Commands

- `npm run verify -- <bundleDir> [--previous <dir>]` — verify **your** bundle; fix all errors before handoff.
- `npm run verify:sample` — runs the small UPB sample in `fixtures/upb/` (sanity check that your checkout works).
- `npm run fixtures:sync` — regenerates `manifest.json` for fixture dirs that use `fixture.config.json` (see `fixtures/README.md`).
- `npm run test` — verifier tests against repo fixtures.
- `npm run ci` — same checks as GitHub Actions (lint, format, typecheck, test, `verify:sample`).

## Packages (for integrators)

- **`packages/schema`** — `CourseRow`, `SectionRow`, `ScheduleRow`, manifest types, validators.
- **`packages/verifier-sdk`** — semantic checks, hashing, regression vs `--previous`, report output.
- **`scripts/sync-fixture-manifests.ts`** — used to rebuild fixture manifests after editing row JSON in this repo.
