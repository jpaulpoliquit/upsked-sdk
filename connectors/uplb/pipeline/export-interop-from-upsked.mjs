#!/usr/bin/env node
/**
 * Convert fixtures/uplb/sample-upsked-bundle (snake_case AISIS-style) into verifier row JSON:
 * courses.json, sections.json, schedules.json, metadata.json, programs.json (optional).
 * Does not write manifest.json — run `npm run fixtures:sync` from upsked-sdk repo root.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');

function parseArgs(argv) {
  const out = {
    inputDir: join(REPO_ROOT, 'fixtures/uplb/sample-upsked-bundle'),
    outDir: join(REPO_ROOT, 'fixtures/uplb/sample-release'),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--input' || a === '-i') out.inputDir = resolve(argv[++i]);
    else if (a === '--out' || a === '-o') out.outDir = resolve(argv[++i]);
  }
  return out;
}

function toInteropCourse(row) {
  return {
    id: row.id,
    title: row.title,
    ...(row.offering_unit_abbr != null ? { offeringUnit: String(row.offering_unit_abbr) } : {}),
    ...(typeof row.units_default === 'number' ? { unitsDefault: row.units_default } : {}),
  };
}

function toInteropSection(row) {
  const dissolved =
    row.is_dissolved === true ||
    String(row.status || '').toLowerCase() === 'dissolved' ||
    String(row.status || '').toLowerCase() === 'cancelled';
  const status = dissolved ? 'dissolved' : 'open';
  return {
    id: String(row.class_code),
    classCode: String(row.class_code),
    courseId: String(row.course_id),
    sectionCode: String(row.section_code ?? row.section ?? ''),
    semesterId: String(row.semester_id),
    status,
    ...(row.slots_available != null ? { slotsAvailable: row.slots_available } : {}),
    ...(row.slots_total != null ? { slotsTotal: row.slots_total } : {}),
    ...(row.enlisting_unit != null ? { offeringUnit: String(row.enlisting_unit) } : {}),
  };
}

function toInteropSchedule(row, index) {
  const classCode = String(row.section_class_code);
  const ts = row.time_start != null ? String(row.time_start) : '';
  const te = row.time_end != null ? String(row.time_end) : '';
  const id = `${classCode}-${row.day}-${ts}-${te}-${index}`;
  const out = {
    id,
    day: String(row.day),
    timeStart: ts,
    timeEnd: te,
    classCode,
  };
  if (row.class_type != null && row.class_type !== '') {
    out.classType = String(row.class_type);
  }
  if (row.room != null && row.room !== '') out.room = String(row.room);
  return out;
}

function toInteropMetadata(raw) {
  const generatedAt = raw.scrapedAt || raw.generatedAt || new Date().toISOString();
  return {
    generatedAt,
    connectorVersion: 'uplb-amis-clean-upsked-1',
    sourceType: 'local_bundle',
    ...(raw.sourcePublishedAt ? { sourcePublishedAt: raw.sourcePublishedAt } : {}),
    ...(typeof raw.rawPayloadCount === 'number' ? { rawPayloadCount: raw.rawPayloadCount } : {}),
  };
}

async function main() {
  const { inputDir, outDir } = parseArgs(process.argv.slice(2));

  const coursesRaw = JSON.parse(await readFile(join(inputDir, 'courses.json'), 'utf8'));
  const sectionsRaw = JSON.parse(await readFile(join(inputDir, 'sections-upsked.json'), 'utf8'));
  let schedulesRaw = JSON.parse(await readFile(join(inputDir, 'schedules-upsked.json'), 'utf8'));
  const metadataRaw = JSON.parse(await readFile(join(inputDir, 'metadata.json'), 'utf8'));

  schedulesRaw = schedulesRaw.filter((s) => {
    const ts = s.time_start != null ? String(s.time_start) : '';
    const te = s.time_end != null ? String(s.time_end) : '';
    if (!/^\d{2}:\d{2}:\d{2}$/.test(ts) || !/^\d{2}:\d{2}:\d{2}$/.test(te)) return false;
    const hm = (t) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    return hm(te) > hm(ts);
  });

  const courses = coursesRaw.map(toInteropCourse);
  const sections = sectionsRaw.map(toInteropSection);
  const schedules = schedulesRaw.map(toInteropSchedule);
  const metadata = toInteropMetadata(metadataRaw);

  let programs = null;
  try {
    programs = JSON.parse(await readFile(join(inputDir, 'programs.json'), 'utf8'));
  } catch {
    /* optional */
  }

  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'courses.json'), `${JSON.stringify(courses, null, 2)}\n`);
  await writeFile(join(outDir, 'sections.json'), `${JSON.stringify(sections, null, 2)}\n`);
  await writeFile(join(outDir, 'schedules.json'), `${JSON.stringify(schedules, null, 2)}\n`);
  await writeFile(join(outDir, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);
  if (programs != null) {
    await writeFile(join(outDir, 'programs.json'), `${JSON.stringify(programs, null, 2)}\n`);
  }

  console.log(`Wrote interop row JSON → ${outDir}`);
  console.log(
    `  courses: ${courses.length}, sections: ${sections.length}, schedules: ${schedules.length}` +
      (programs != null ? `, programs: ${programs.length}` : '')
  );
  console.log('  Next: npm run fixtures:sync (repo root)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
