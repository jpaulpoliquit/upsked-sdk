#!/usr/bin/env node
/**
 * Read merged AMIS classes JSON and write Upsked-shaped bundle (courses, departments,
 * sections-upsked, schedules-upsked, metadata, optional programs).
 *
 * Optional: --courses-page for paginated course catalog JSONs; --programs for all-programs export.
 *
 * Usage:
 *   node pipeline/clean-for-upsked.cjs
 *   node pipeline/clean-for-upsked.cjs --input ./fixtures/upb/sample-amis-classes-merged.json --out ./fixtures/upb/sample-upsked-bundle --semester-id upb-2025-2
 */
const fs = require("fs");
const path = require("path");
const {
  buildUpbUpskedArtifacts,
  writeBundle,
  mergePaginatedAmisCourses,
  buildProgramsUpsked,
} = require("./lib/upb-amis-clean-upsked.cjs");

const REPO_ROOT = path.join(__dirname, "..", "..", "..");

function parseArgs(argv) {
  const out = {
    input: path.join(REPO_ROOT, "fixtures", "upb", "sample-amis-classes-merged.json"),
    outDir: path.join(REPO_ROOT, "fixtures", "upb", "sample-upsked-bundle"),
    semesterId: process.env.UPB_SEMESTER_ID || "upb-2025-2",
    coursePagePaths: [],
    programsPath: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--input" || a === "-i") {
      out.input = path.resolve(argv[++i]);
    } else if (a === "--out" || a === "-o") {
      out.outDir = path.resolve(argv[++i]);
    } else if (a === "--semester-id" || a === "-s") {
      out.semesterId = argv[++i];
    } else if (a === "--courses-page" || a === "--cp") {
      out.coursePagePaths.push(path.resolve(argv[++i]));
    } else if (a === "--programs" || a === "-p") {
      out.programsPath = path.resolve(argv[++i]);
    }
  }
  return out;
}

function main() {
  const { input, outDir, semesterId, coursePagePaths, programsPath } = parseArgs(
    process.argv.slice(2),
  );

  if (!fs.existsSync(input)) {
    console.error(`Input not found: ${input}`);
    process.exit(1);
  }

  for (const p of coursePagePaths) {
    if (!fs.existsSync(p)) {
      console.error(`Courses page not found: ${p}`);
      process.exit(1);
    }
  }

  if (programsPath && !fs.existsSync(programsPath)) {
    console.error(`Programs file not found: ${programsPath}`);
    process.exit(1);
  }

  const merged = JSON.parse(fs.readFileSync(input, "utf8"));

  let mergedCourseCatalogRows = null;
  if (coursePagePaths.length > 0) {
    mergedCourseCatalogRows = mergePaginatedAmisCourses(coursePagePaths);
  }

  const bundle = buildUpbUpskedArtifacts({
    merged,
    semesterId,
    sourceLabel: `file:${path.basename(input)}`,
    mergedCourseCatalogRows,
  });

  const programs =
    programsPath != null
      ? buildProgramsUpsked(JSON.parse(fs.readFileSync(programsPath, "utf8")))
      : undefined;

  writeBundle(outDir, programs != null ? { ...bundle, programs } : bundle);

  console.log(`Wrote Upsked bundle → ${outDir}`);
  console.log(
    `  courses: ${bundle.courses.length}, departments: ${bundle.departments.length}, sections: ${bundle.sections.length}, schedule rows: ${bundle.schedules.length}`,
  );
  if (mergedCourseCatalogRows) {
    console.log(`  course catalog rows merged: ${mergedCourseCatalogRows.length}`);
  }
  if (programs != null) {
    console.log(`  programs: ${programs.length}`);
  }
  console.log(`  semester_id: ${semesterId}`);
}

main();
