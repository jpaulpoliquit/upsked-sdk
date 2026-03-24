# Contributing

## Setup

```bash
cd upsked-sdk   # or repo root if this is the whole project
npm ci
npm run typecheck
npm test
```

## Before opening a PR

**Shortcut:** `npm run ci` (lint + format check + typecheck + test + `verify:sample`).

Or step by step:

1. `npm run lint` — ESLint (TypeScript)
2. `npm run format:check` — Prettier
3. `npm run typecheck`
4. `npm test`
5. `npm run verify:sample` (or `npm run verify -- <your-bundle> --previous <dir>` if you changed fixtures)

## Changing the contract

- Bump `SCHEMA_VERSION` in `packages/schema/src/index.ts` when row shapes change; document in PR.
- Bump `VERIFIER_VERSION` in `packages/verifier-sdk/src/verifier.ts` when verifier behavior changes materially.

## Docs

- User-facing flow: [docs/CONTRIBUTOR_GUIDE.md](docs/CONTRIBUTOR_GUIDE.md)
- If you add a new artifact kind, update `packages/schema`, `packages/verifier-sdk` builder + verifier, and docs.

## Repository URL

If you forked, update `repository` / `bugs` / `homepage` in root `package.json` to match your GitHub remote (see [STANDALONE.md](STANDALONE.md)).
