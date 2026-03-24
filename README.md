# UPSked SDK

This repo holds **partner connector** code: schema, verifier SDK, and sample bundles. It is meant to live **outside** the main UPSked app. For paths into the monorepo (strategy doc, ingest contract, `getCatalogManifest`, …), see [docs/UPSTREAM_LINKS.md](docs/UPSTREAM_LINKS.md).

**Job:** help partners produce **verified** release bundles UPSked can ingest safely (see [docs/CONTRIBUTOR_GUIDE.md](docs/CONTRIBUTOR_GUIDE.md)).

**Start here:** [docs/CONTRIBUTOR_GUIDE.md](docs/CONTRIBUTOR_GUIDE.md) — artifacts, extractor patterns, work order, commands (written to be the single comprehensive entrypoint).

**Publishing this folder as its own GitHub repo:** [STANDALONE.md](STANDALONE.md) — tsconfig, CI, lockfile, docs links. **Mapping to the main UPSked app:** [docs/UPSTREAM_LINKS.md](docs/UPSTREAM_LINKS.md).

**Contributing:** [CONTRIBUTING.md](CONTRIBUTING.md) · **Security:** [SECURITY.md](SECURITY.md)

## Target layout

```text
upsked-sdk/
  connectors/
    admu/
    uplb/
  fixtures/
    admu/
    uplb/
  packages/
    schema/
    verifier-sdk/
  docs/
    connector-spec.md
    validation-spec.md
    ops-model.md
```

## Responsibilities

- `packages/schema`
  - canonical release manifest and artifact schemas
  - row-level schemas for courses, sections, schedules, metadata
- `packages/verifier-sdk`
  - semantic and referential validation
  - release hashing
  - diffing against previous accepted releases
  - report generation
- `connectors/<university_id>`
  - source-specific extract and normalize logic
  - calls verifier before publish or submit
- `fixtures/<university_id>`
  - redacted samples for deterministic tests
- `docs/*`
  - contributor instructions
  - validation rules
  - operating model

## Relationship To Main App Repo

The product app repo should only own:

- ingest/control-plane APIs
- current release pointer resolution
- runtime manifest lookup
- app consumption of promoted releases

The connector repo should not own UPSked tables or runtime serving logic.

## Implemented packages

- `packages/schema/src/index.ts`
  - canonical manifest, artifact, row, and metadata types
  - contract validators for manifest and bundle rows
- `packages/verifier-sdk/src/verifier.ts`
  - release-bundle verification with schema, identity, referential, semantic, integrity, and regression checks
- `packages/verifier-sdk/src/builder.ts`
  - manifest builder for local connector outputs
- `scripts/sync-fixture-manifests.ts`
  - regenerates fixture manifests from `fixture.config.json`

## Local commands

- `npm run verify -- <bundleDir> [--previous <dir>] [--out report.json]`
  - general verifier entry (same as `packages/verifier-sdk` CLI)
- `npm run fixtures:sync`
  - rebuilds fixture `manifest.json` files from the local bundle contents
- `npm run test`
  - runs the verifier end-to-end against the sample fixtures
- `npm run verify:sample`
  - prints a full verifier report for the sample UPLB release
- `npm run typecheck`
  - checks the TypeScript packages without emitting build output
- `npm run lint`
  - ESLint on `packages/`, `scripts/`, `connectors/`
- `npm run format` / `npm run format:check`
  - Prettier on TS + markdown + workflow YAML
- `npm run ci`
  - lint + format check + typecheck + test + `verify:sample` (same gates as GitHub Actions)
