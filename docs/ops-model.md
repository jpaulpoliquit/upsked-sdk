# Ops Model

## Operating principle

Freshness does not outrank safety.

- stale but valid beats fresh but suspicious
- a bad release must not overwrite the live release
- rollback is pointer-based

## Trust tiers

- `community`
  - manual promotion required
- `verified_partner`
  - auto-promotion allowed when warnings and anomaly thresholds permit
- `managed`
  - UPSked-operated source and release path

## Submission cadence

- connectors run on their own schedule
- successful runs emit immutable releases
- UPSked accepts, validates, stages, and optionally promotes

## Failure handling

- ingest failure leaves the current release untouched
- validation failure records the full verifier output
- promotion failure leaves the release staged, not live

## Observability

Every ingest run should record:

- source
- connector version
- token provenance
- timings
- artifact hashes
- validation summary
- promotion decision
