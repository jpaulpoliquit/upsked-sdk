# Validation Spec

**Connector authors:** your local gate is the **verifier** in `packages/verifier-sdk`; this document names the conceptual layers (schema, identity, semantics, …) behind that tool.

UPSked should stage or promote releases based on one consistent verifier contract. **Implementations:** `upsked-sdk/packages/verifier-sdk` (this repo) and, eventually, server-side ingest. Step-by-step workflow: [CONTRIBUTOR_GUIDE.md](./CONTRIBUTOR_GUIDE.md).

## Validation layers

- `schema`
  - required fields
  - supported schema versions
  - enum domains
  - bounds and formats
- `identity`
  - canonical `universityId`
  - canonical `semesterId`
  - stable course, section, and class code identity
- `referential`
  - sections reference valid courses
  - schedules reference valid sections
  - parent-child section links resolve
- `semantic`
  - valid day tokens
  - valid time ranges
  - valid units and statuses
  - no broken parent-child structures
- `release_integrity`
  - hashes match
  - counts match
  - artifacts are complete
  - bundle is immutable
- `regression`
  - suspicious section or schedule drops
  - disappeared departments
  - null-room spikes
  - class-code duplication spikes

## Result types

- `error`
  - blocks staging
- `warning`
  - allows staging
  - blocks auto-promotion unless trust-tier policy says otherwise
- `info`
  - audit only

## Output contract

The report must contain:

- summary counts
- issue list
- metrics
- previous release reference
- anomaly deltas
- auto-promotion eligibility
