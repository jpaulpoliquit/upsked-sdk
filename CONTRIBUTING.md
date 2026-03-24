# Contributing

## If you are building a connector (external partner or new school)

1. Read **[docs/CONTRIBUTOR_GUIDE.md](docs/CONTRIBUTOR_GUIDE.md)** first — it defines the bundle layout, verifier workflow, and definition of done.
2. Use **[docs/connector-spec.md](docs/connector-spec.md)** as a checklist while you implement.
3. Keep secrets and live session data **out** of git; use redacted fixtures only.
4. Before you share a bundle with UPSked, run:

   ```bash
   npm run verify -- path/to/your-bundle --previous path/to/last-accepted-bundle
   ```

   and resolve **all** verifier errors (see the guide for `--previous` when the semester already had an accepted release).

5. Open issues or PRs **in this repository** for schema or verifier bugs. Product or account questions go through your UPSked contact.

## If you are changing the SDK, schema, or verifier (maintainers)

```bash
cd upsked-sdk   # or your clone root
npm ci
npm run ci
```

**Before opening a PR:** `npm run ci` (lint, format check, typecheck, test, `verify:sample`).

Or step by step:

1. `npm run lint`
2. `npm run format:check`
3. `npm run typecheck`
4. `npm run test`
5. `npm run verify:sample` (or `npm run verify -- <bundle> --previous <dir>` if fixtures changed)

### Contract changes

- Bump `SCHEMA_VERSION` in `packages/schema/src/index.ts` when row shapes change; document in the PR.
- Bump `VERIFIER_VERSION` in `packages/verifier-sdk/src/verifier.ts` when verifier behavior changes materially.
- If you add a new artifact kind, update `packages/schema`, `packages/verifier-sdk` (builder + verifier), and `docs/`.

### Forks

Update `repository`, `bugs`, and `homepage` in root `package.json` to match your GitHub remote.
