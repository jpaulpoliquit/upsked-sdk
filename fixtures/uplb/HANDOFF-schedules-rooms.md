# Handoff: connect `schedules.json` ↔ `rooms.json` (UPLB bundle)

**Bundle path:** `interop-repo/fixtures/uplb/bundle/` (or `UPLB_BUNDLE_DIR`).

## What each file is

### `schedules.json`

Array of **`SectionSchedule`** (see `apps/scraper/src/types.ts`).

| Field | Example | Notes |
|-------|---------|--------|
| `section_class_code` | `uplb-1252-1` | Synthetic id: `uplb-{term_id}-{classes.id}` from SQLite |
| `day` | `M`, `T`, `W`, `TH`, `F`, `S` | |
| `time_start` / `time_end` | `07:00:00` | HH:mm:ss |
| `room` | `CAFS Admin Building 237` | **Single free-text string** — not a foreign key today |
| `class_type` | `lec` / `lab` | From class row type |
| `schedule_raw` | `F 07:00AM-10:00AM` | Original segment text |

**Source pipeline:** `info.db` → `classes` joined to `rooms` + `buildings` → `loadClassesFromSqlite` → `buildSectionsAndSchedules` in `apps/scraper/src/uplb/from-sqlite-classes.ts`.  
Per meeting row, the label passed into the schedule parser is:

`roomLabel = [building_name, room_code].filter(Boolean).join(' ')`

So `schedules[].room` is whatever **`parseScheduleString`** extracted using that label (see `apps/scraper/src/uplb/parse-schedule-string.ts`).

### `rooms.json`

Array of **`RoomExportRow`** from `apps/scraper/src/uplb/uplb-optional-artifacts.ts`:

| Field | Notes |
|-------|--------|
| `building` | Building display name from **`app_data.json`** (`buildings` map) |
| `room` | Room string as listed under that building (often short, e.g. `ABC 161`) |
| `lat`, `lon`, `directions`, `osm_link` | From the same building block in `app_data.json` |

**Important:** `rooms.json` is **not** joined to SQLite in the emitter. It comes from the **mobile/campus app export** (`--app-data-json`), while schedule room text comes from **AMIS/SQLite class snapshot**. Naming conventions can differ (abbreviations, “Building 237” vs room-only, etc.).

## Why they are not “connected” yet

- No shared **`room_id`** or stable key between schedule rows and catalog rows.
- `schedules[].room` is one concatenated string; `rooms.json` splits **`building` + `room`** — reconciliation requires **normalization + matching** (exact, fuzzy, or manual alias table).
- Interop **does not** validate schedule room strings against `rooms.json` today (see `interop-repo/README.md` systems map).

## Suggested directions for the next agent

1. **Analysis:** Build a report: distinct `schedules[].room` values vs `(building + " " + room)` keys from `rooms.json`; count unmatched, show top examples.
2. **Schema (optional):** Add optional `room_catalog_index` or `building` + `room_code` on schedule rows once mapping exists — coordinate with `apps/scraper` types + emitter.
3. **Matching:** Normalize whitespace/case; try token overlap; consider alias map for known campus quirks (document in code or small JSON).
4. **Verifier:** Extend `verify-uplb-bundle.ts` or a small script to assert coverage % or list orphans (non-blocking warnings first).

## Code entry points

- `apps/scraper/src/uplb/from-sqlite-classes.ts` — `roomLabel`, `parseScheduleString`
- `apps/scraper/src/uplb/parse-schedule-string.ts`
- `apps/scraper/src/uplb/uplb-optional-artifacts.ts` — `buildRoomsFromAppData`, `RoomExportRow`
- `apps/scraper/src/types.ts` — `SectionSchedule`, `Section`
- `apps/scraper/scripts/uplb-amis-to-bundle.ts` — `--include-rooms` + `--app-data-json`

## Row counts (typical full bundle)

Order of magnitude: **~6k** schedule rows, **~500** room catalog rows — many schedule lines share the same room string; many strings will not match 1:1 without normalization.
