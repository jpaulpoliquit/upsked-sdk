# Publishing as its own GitHub repository

Use this checklist when moving `interop-repo/` out of the UPSked monorepo.

## Before first push

- [ ] **Root is the repo** — Contents of `interop-repo/` become the git root (not a subfolder named `interop-repo` unless you want that layout).
- [ ] **Separate from the monorepo’s git** — If the parent UPSked repo lists `/interop-repo/` in `.gitignore` (so this tree is not tracked there), run `git init` **inside this folder** and add GitHub as `origin` here. That is a second repository alongside the monorepo, not a subdirectory of it; the ignore rule only means the big repo never commits these files.
- [ ] **`tsconfig.json`** — Uses only local `node_modules` (no `../apps/web` paths). Fixed in-repo.
- [ ] **`LICENSE`** — Present (AGPL-3.0 copy from main UPSked repo, or replace with your policy).
- [ ] **`package.json`** — Confirm GitHub URLs match your org/repo (this checkout: `jpaulpoliquit/upsked-sdk`); adjust `name` if you publish under a different npm name.
- [ ] **`package-lock.json`** — Commit it; run `npm install` from the new root and re-run `npm run typecheck` + `npm test`.
- [ ] **`.gitignore`** — Includes `node_modules/`, env files, OS junk (template in this repo).

## CI

- [ ] `.github/workflows/ci.yml` runs `npm ci`, `npm run typecheck`, `npm test`, `npm run verify:sample` on PRs/main.

## Docs

- [ ] Replace any remaining monolith-only paths in your fork (search for `apps/web` in `docs/`).
- [ ] Read [docs/UPSTREAM_LINKS.md](docs/UPSTREAM_LINKS.md) for how this repo maps to the main app.

## Optional

- [ ] **Explicit workspace deps** — `verifier-sdk` currently imports `interop-schema` via **relative paths** (`../../schema`). If you move to npm/pnpm `workspace:*` protocol, ensure your npm version supports it (npm 7+) or use `file:../packages/schema` in `verifier-sdk/package.json` until you publish to npm.
- [ ] **npm scopes** — Publish `@upsked/interop-schema` / `@upsked/verifier-sdk` to npm (build step + `dist/` needed first).
- [ ] **Changesets / release-please** — Versioning for published packages.

**Done in-repo:** ESLint + Prettier (`npm run lint`, `npm run format`), [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), placeholder `repository` / `bugs` / `homepage` in `package.json`.

## Verify locally (clean clone simulation)

```bash
cd upsked-sdk
rm -rf node_modules
npm ci
npm run typecheck
npm test
npm run verify:sample
```

All must pass with **no** parent directory present.
