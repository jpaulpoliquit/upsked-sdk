The verified bundle lives in **`bundle/`** (same layout as the scraper emitter output).

- **Default path** for `npm run verify:uplb` / `verify-uplb-interop.ts` is `interop-repo/fixtures/uplb/bundle`.
- Regenerate: `npx tsx apps/scraper/scripts/uplb-amis-to-bundle.ts ... --out interop-repo/fixtures/uplb/bundle`
- Override: `UPLB_BUNDLE_DIR=/other/path npm run verify:uplb`

Required files for full checks: `courses.json`, `sections.json`, `schedules.json`, `metadata.json`, plus `curricula.json` / `course_requisites.json` if you want curriculum + requisite cross-refs validated.
