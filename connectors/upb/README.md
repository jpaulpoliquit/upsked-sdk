# UP Baguio (UPB) connector (reference implementation)

This folder shows the shape of an **`upsked-sdk` connector**.

The source system can be anything: AMIS, an official API, CSV exports, registrar dumps, browser-captured JSON. The job stays the same:

1. extract raw data from the school system
2. normalize it into UPSked artifacts
3. build a verifier-ready release bundle
4. hand that bundle to whatever ingest / promote process your deployment uses

This repo stops at the **verified bundle on disk**. It does **not** write to UPSked production by itself.

Generic SDK rules: [CONTRIBUTOR_GUIDE.md](../../docs/CONTRIBUTOR_GUIDE.md), [connector-spec.md](../../docs/connector-spec.md).  
Semester id slugs (`upb-2025-2`, ...): [upb-catalog-semester-id.md](../../docs/upb-catalog-semester-id.md).

---

## Prerequisites

- **Node.js ≥ 18**
- **Install deps once** at the **`upsked-sdk` repo root**:

```bash
cd upsked-sdk
npm install
```

All commands below assume that install; scripts use plain `node` plus workspace-hoisted `tsx` where noted.

---

## Where to run commands

| You want                       | Working directory           | Notes                                       |
| ------------------------------ | --------------------------- | ------------------------------------------- |
| npm scripts for this connector | `upsked-sdk/connectors/upb` | `npm run amis:clean`, etc.                  |
| Same scripts via workspace     | `upsked-sdk` (root)         | `npm run <script> -w @upsked/connector-upb` |
| Full verifier CLI              | `upsked-sdk` (root)         | `npm run verify -- <bundleDir> ...`         |

Paths like `fixtures/upb/...` are always relative to **`upsked-sdk/`** (three levels above `connectors/upb`).

---

## Happy path (copy-paste)

This is the **UPB example flow**. The current source for this connector is AMIS, so the script names are `amis:*`. If another school builds on top of `upsked-sdk`, the command names may differ, but the flow should still look like:

`extract -> normalize -> build bundle -> build manifest -> verify -> handoff`

Replace page paths and semester id as needed.

```bash
# 0) Repo root
cd upsked-sdk

# 1) Merge source pages for this reference connector
npm run amis:pages -w @upsked/connector-upb -- path/to/classes-page1.json path/to/classes-page2.json

# 2) Build UPSked-style bundle → fixtures/upb/sample-upsked-bundle/
npm run amis:clean -w @upsked/connector-upb

# 3) Export camelCase interop rows for the verifier → fixtures/upb/full-upb-2025-2-interop/
npm run amis:export-interop -w @upsked/connector-upb

# 4) Manifest config: export-interop does NOT write manifest.json. Seed fixture.config.json
#    (edit publishedAt, connectorVersion, catalogSourceId for your release).
cp fixtures/upb/sample-release/fixture.config.json fixtures/upb/full-upb-2025-2-interop/fixture.config.json

# 5) Build manifest.json + run verifier (exits 1 if blocking errors).
npx tsx connectors/upb/src/verify-release.ts fixtures/upb/full-upb-2025-2-interop fixtures/upb/previous-release

# 6) Optional: same check via CLI only (needs manifest.json from step 5).
npm run verify -- fixtures/upb/full-upb-2025-2-interop --previous fixtures/upb/previous-release
```

If you prefer **not** using `-w`, `cd connectors/upb` and run `npm run amis:pages -- …`, `npm run amis:clean`, etc.

---

## Step-by-step

### 1. Capture data from your source system

This reference connector happens to use **AMIS**, but the front half can be any school-specific source. Common patterns:

- **Browser console / session-backed fetches**: useful when the system only exposes data inside an authenticated web app
- **HAR / network capture**: useful when you want a replayable artifact from the browser
- **Official API / batch export**: best when the school gives you stable endpoints or dump files
- **CSV / spreadsheet / registrar export**: still fine, as long as you map it into the SDK row shapes cleanly

For the UPB example in this folder, the source is **AMIS**.

### 2. Merge source pages -> `sample-amis-classes-merged.json`

```bash
cd upsked-sdk/connectors/upb
npm run amis:pages -- /absolute/or/relative/path/to/page1.json /path/to/page2.json
```

Writes:

- `fixtures/upb/sample-amis-classes-merged.json`
- `fixtures/upb/upb-sections-raw.json` (transformed sections; diagnostic)

### 3. (Optional) HAR instead of manual pages

```bash
cd upsked-sdk/connectors/upb
npm run amis:har -- /path/to/capture.har
```

Expects a HAR that contains a `/api/students/classes` response (see script header). Use this when you already exported network capture; you may still need step 4 for a full bundle.

### 4. Clean → `sample-upsked-bundle/`

**Default** (reads merged file + writes bundle under `fixtures/upb/sample-upsked-bundle`):

```bash
npm run amis:clean -w @upsked/connector-upb
```

**Custom input / output / semester** (underlying CLI):

```bash
cd upsked-sdk/connectors/upb
node pipeline/clean-for-upsked.cjs \
  --input /path/to/sample-amis-classes-merged.json \
  --out /path/to/out-bundle \
  --semester-id upb-2025-2
```

**Optional extra AMIS files** (course catalog pages + programs export):

```bash
node pipeline/clean-for-upsked.cjs \
  --courses-page /path/to/courses-only-page1.json \
  --courses-page /path/to/courses-only-page2.json \
  --programs /path/to/all-programs.json
```

Override semester when generating: set env **`UPB_SEMESTER_ID`** (or `UPLB_SEMESTER_ID`) before `amis:clean`, or pass `--semester-id`.

Outputs include `courses.json`, `sections-upsked.json`, `schedules-upsked.json`, `metadata.json`, etc. This is the **normalized SDK bundle**. Downstream systems can consume it, but this connector does not depend on them being present.

### 5. Export interop JSON → `full-upb-2025-2-interop/`

```bash
npm run amis:export-interop -w @upsked/connector-upb
```

Defaults: read `fixtures/upb/sample-upsked-bundle`, write `fixtures/upb/full-upb-2025-2-interop`.  
Custom I/O:

```bash
cd upsked-sdk/connectors/upb
node pipeline/export-interop-from-upsked.mjs --input /path/to/upsked-bundle --out /path/to/interop-out
```

Does **not** update the tiny **`sample-release/`** fixture used in CI.

### 6. Manifest + verify (full interop directory)

`npm run verify -- <dir>` expects **`manifest.json`** at the bundle root. After **`amis:export-interop`**:

1. Copy a template config and adjust fields (`publishedAt`, `connectorVersion`, `catalogSourceId` should match the release identity your ingest side expects):

   ```bash
   cd upsked-sdk
   cp fixtures/upb/sample-release/fixture.config.json fixtures/upb/full-upb-2025-2-interop/fixture.config.json
   ```

2. **Build `manifest.json` and run the verifier** in one step (writes `manifest.json`, `manifest.generated.json`, `report.generated.json` under the bundle):

   ```bash
   npx tsx connectors/upb/src/verify-release.ts fixtures/upb/full-upb-2025-2-interop fixtures/upb/previous-release
   ```

3. Optional cross-check with the verifier CLI (same gates; needs step 2 completed):

   ```bash
   npm run verify -- fixtures/upb/full-upb-2025-2-interop --previous fixtures/upb/previous-release
   ```

**Tiny CI fixture only** (sanity check):

```bash
cd upsked-sdk
npm run verify:sample
```

**Connector script** (rebuilds manifest for `sample-release` from `fixture.config.json`, then verifies):

```bash
cd upsked-sdk/connectors/upb
npm run verify:fixture
```

Verifier output may write `report.generated.json` under the bundle; exit code non‑zero if the report is **blocking**.

### 7. (SDK maintenance) Regenerate fixture manifests

From **`upsked-sdk`** root only:

```bash
npm run fixtures:sync
```

Then:

```bash
npm run verify:sample
```

---

## npm scripts reference (`connectors/upb/package.json`)

| Script                | Command                                        | Purpose                                                  |
| --------------------- | ---------------------------------------------- | -------------------------------------------------------- |
| `amis:pages`          | `node pipeline/process-amis-pages.cjs`         | Merge AMIS class pages → merged JSON + raw sections      |
| `amis:har`            | `node pipeline/transform-from-har.cjs`         | Extract classes from a HAR                               |
| `amis:clean`          | `node pipeline/clean-for-upsked.cjs`           | Merged JSON → `sample-upsked-bundle`                     |
| `amis:export-interop` | `node pipeline/export-interop-from-upsked.mjs` | `sample-upsked-bundle` → interop JSON dir                |
| `verify:fixture`      | `tsx src/verify-release.ts …`                  | Manifest + verify `sample-release` vs `previous-release` |

---

## After you have a verified bundle

1. **Definition of done:** verifier exits **0** (no blocking errors) on the directory you will ship—after **`manifest.json`** exists, `npm run verify -- <dir>` should also exit **0** (see [CONTRIBUTOR_GUIDE.md](../../docs/CONTRIBUTOR_GUIDE.md) §3–4).
2. **Handoff:** deliver that directory + verifier report through the channel your UPSked deployment defines. That may be an out-of-band folder handoff, an ingest API, or an internal release pipeline.
3. **Promote:** partners / connector authors usually stop here. Promote belongs to the deployment side, not the connector itself.

---

## Repo boundary

Treat this repo as standalone.

- It is responsible for **connector code**, **artifact generation**, and **verification**.
- It is **not** responsible for the product app UI, production database writes, or operator-side promotion.
- Another repo can consume the generated bundle, but that is downstream from this SDK boundary.

---

## Layout

| Path                         | Role                                                                                            |
| ---------------------------- | ----------------------------------------------------------------------------------------------- |
| `pipeline/`                  | Merge pages, HAR extract, clean, export interop                                                 |
| `pipeline/lib/`              | `upb-amis-transform`, `upb-amis-clean-upsked`                                                   |
| `extract-classes-browser.js` | Paste in browser on AMIS (e.g. `amis.upb.edu.ph`)                                               |
| `src/verify-release.ts`      | Build `manifest.json` from `fixture.config.json` + verify vs optional `--previous` dir (see §6) |

| `fixtures/upb/…`                  | Role                                                              |
| --------------------------------- | ----------------------------------------------------------------- |
| `sample-amis-classes-merged.json` | Merged AMIS `classes` export                                      |
| `sample-upsked-bundle/`           | UPSked-shaped normalized JSON bundle                              |
| `sample-release/`                 | **Small** verifier bundle for CI                                  |
| `full-upb-2025-2-interop/`        | Full interop JSON; default `amis:export-interop` output           |
| `previous-release/`               | Prior bundle for regression in `npm run verify -- … --previous …` |
