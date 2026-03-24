#!/usr/bin/env node
/**
 * Merge paginated AMIS `classes` JSON exports and write merged blob + raw section rows.
 *
 * Usage:
 *   node pipeline/process-amis-pages.cjs path/to/page1.json [page2.json ...]
 */
const fs = require("fs");
const path = require("path");
const { transformAmisClasses } = require("./lib/upb-amis-transform.cjs");

const REPO_ROOT = path.join(__dirname, "..", "..", "..");
const DEFAULT_OUT_DIR = path.join(REPO_ROOT, "fixtures", "upb");

const args = process.argv.slice(2).filter((a) => a !== "--");

if (args.length === 0) {
  console.error(
    "Usage: node pipeline/process-amis-pages.cjs <classes-page1.json> [classes-page2.json ...]",
  );
  process.exit(1);
}

const parsed = [];
for (const filePath of args) {
  const abs = path.resolve(filePath);
  const raw = fs.readFileSync(abs, "utf8");
  const j = JSON.parse(raw);
  const page = j.classes?.current_page;
  const data = j.classes?.data;
  if (!Array.isArray(data)) {
    console.error(`No classes.data array in ${abs}`);
    process.exit(1);
  }
  parsed.push({ abs, page, data, classes: j.classes });
}

parsed.sort((a, b) => (a.page || 0) - (b.page || 0));

const seen = new Map();
const merged = [];
for (const { page, data, abs } of parsed) {
  for (const row of data) {
    const id = row.id;
    if (seen.has(id)) {
      console.warn(
        `duplicate class id ${id} (skipping duplicate from ${path.basename(abs)} page ${page})`,
      );
      continue;
    }
    seen.set(id, true);
    merged.push(row);
  }
}

const base = parsed[0].classes;
const totalFromApi = base?.total;
if (typeof totalFromApi === "number" && merged.length !== totalFromApi) {
  console.warn(`Row count ${merged.length} !== API total ${totalFromApi} — check missing pages.`);
}

const mergedWrapper = {
  classes: {
    ...base,
    current_page: 1,
    last_page: 1,
    data: merged,
    merged_from_files: parsed.map((p) => path.basename(p.abs)),
    merged_at: new Date().toISOString(),
  },
};

const outDir = DEFAULT_OUT_DIR;
fs.mkdirSync(outDir, { recursive: true });

const mergedPath = path.join(outDir, "sample-amis-classes-merged.json");
fs.writeFileSync(mergedPath, JSON.stringify(mergedWrapper, null, 2));

const sections = transformAmisClasses(merged);
const sectionsPath = path.join(outDir, "upb-sections-raw.json");
fs.writeFileSync(sectionsPath, JSON.stringify(sections, null, 2));

console.log(`Merged ${merged.length} class rows from ${parsed.length} file(s) → ${mergedPath}`);
console.log(`Transformed → ${sectionsPath} (${sections.length} sections)`);
