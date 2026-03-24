# UPLB Connector

First target for a truly external connector.

Requirements:

- use the canonical manifest contract
- pass verifier SDK checks in CI
- submit through UPSked ingest only
- never write UPSked runtime tables directly

Implemented scaffold:

- `src/verify-release.ts`
  - regenerates a manifest from the connector bundle
  - runs the verifier against the previous accepted release
  - emits `manifest.generated.json` and `report.generated.json`
