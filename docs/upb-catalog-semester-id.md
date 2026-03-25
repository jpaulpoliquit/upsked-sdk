# UP Baguio catalog semester id (`semester_id` / `semesterId`)

UP Baguio does **not** use Diliman CRS numeric ids (`120252`, …). In manifests, API bodies, and Storage object names we use a **slug**:

```text
upb-{AY_START}-{TERM}
```

| Part | Meaning |
|------|---------|
| `upb-` | Fixed prefix (legacy `uplb-` is accepted at API boundaries and normalized to `upb-`). |
| `AY_START` | **Four-digit calendar year when the academic year begins.** AY spoken as “2526” is `2025` + `2026` → **`2025`**. |
| `TERM` | `1` = first semester · `2` = second semester · `3` = midyear (same numbering sense as planner term, not CRS encoding). |

### Examples

| Spoken / UI | `semesterId` |
|-------------|----------------|
| AY 2025–2026, 1st sem | `upb-2025-1` |
| AY 2025–2026, 2nd sem (“2526 2nd sem”) | `upb-2025-2` |
| AY 2025–2026, midyear | `upb-2025-3` |

### Storage and static catalog files

The same string is used verbatim (lowercased after normalization) for:

- `catalog-version-{semesterId}.json`
- `courses-{semesterId}.pbf`

There is **no** conversion to `120252`-style ids for UPB on this path.

### Connectors

- `metadata.json`: use `semester_id` matching this slug (see `fixtures/upb/sample-upsked-bundle`).
- Optional env: `UPB_SEMESTER_ID` / `UPLB_SEMESTER_ID` overrides when generating bundles (see `connectors/upb/pipeline/clean-for-upsked.cjs`).

### Related app constants

The web app default when no bundle metadata is present is `UPB_SEMESTER_FALLBACK_ID` in `apps/web/lib/upb-json-constants.ts` (main monorepo). It must stay aligned with the canonical term you ship.
