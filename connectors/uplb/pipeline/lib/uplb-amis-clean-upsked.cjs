/**
 * UPLB AMIS → UPSked JSON bundle (same artifacts as AISIS: courses, departments,
 * sections-upsked, schedules-upsked, metadata).
 *
 * Input shape (merged export): { classes: { data: AmisClass[] } }
 *
 * AmisClass (relevant fields):
 * - id, term_id, type, section, status, credit, facility_id, max_class_size, active_class_size
 * - course_code, acad_org, class_nbr
 * - course: { course_id, title, units, subject, course_number, career, acad_org, ... }
 * - class_dates[]: { mon..sun booleans, start_time, end_time, date? } — room is usually on parent facility_id
 * - faculties[]: { faculty: { user: { formatted_name, last_name, first_name } } }
 *
 * Semester id is not in the payload; pass --semester-id (e.g. uplb-2026-1).
 */

const fs = require('fs');
const path = require('path');

const DAY_KEYS = [
  ['mon', 'M'],
  ['tue', 'T'],
  ['wed', 'W'],
  ['thu', 'TH'],
  ['fri', 'F'],
  ['sat', 'S'],
  ['sun', 'SU'],
];

function parseTimeToHHMMSS(timeStr) {
  if (!timeStr) return null;
  const compact = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  let hours;
  let minutes;
  if (compact) {
    hours = parseInt(compact[1], 10);
    minutes = compact[2];
    const period = compact[3].toUpperCase();
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
  } else {
    const [t, period] = timeStr.split(' ');
    if (!t) return null;
    const parts = t.split(':');
    hours = parseInt(parts[0], 10);
    minutes = parts[1] || '00';
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
  }
  return `${String(hours).padStart(2, '0')}:${minutes}:00`;
}

function mapClassType(amisType) {
  const u = (amisType || '').toUpperCase();
  if (u === 'LAB' || u === 'LABORATORY') return 'lab';
  if (u === 'REC' || u === 'RECITATION') return 'rec';
  return 'lec';
}

function instructorFromClass(cls) {
  if (!cls.faculties || !Array.isArray(cls.faculties)) return null;
  const names = cls.faculties
    .map((f) => {
      const u = f.faculty?.user;
      const name =
        u?.formatted_name || (u?.last_name && u?.first_name ? `${u.last_name}, ${u.first_name}` : null);
      return name ? String(name).replace(/\.$/, '') : null;
    })
    .filter(Boolean);
  if (names.length === 0) return null;
  return names.join('; ');
}

/**
 * Yields { day, time_start, time_end, room } for each calendar row (class_dates entry or synthetic from root).
 */
function* iterScheduleBlocks(cls) {
  const roomFallback = cls.facility_id && String(cls.facility_id).trim() ? String(cls.facility_id).trim() : null;

  function* emitForObj(obj) {
    const days = DAY_KEYS.filter(([k]) => obj[k] === true).map(([, d]) => d);
    const ts = parseTimeToHHMMSS(obj.start_time);
    const te = parseTimeToHHMMSS(obj.end_time);
    if (days.length === 0 || !ts || !te) return;
    const room = obj.room?.facility_name?.trim() || roomFallback || undefined;
    for (const day of days) {
      yield { day, time_start: ts, time_end: te, room, class_type: mapClassType(cls.type) };
    }
  }

  if (cls.class_dates && cls.class_dates.length > 0) {
    for (const cd of cls.class_dates) {
      yield* emitForObj(cd);
    }
    return;
  }

  yield* emitForObj(cls);
}

function buildClassCode(cls, termId) {
  return `uplb-amis-${termId}-${cls.id}`;
}

function unitsFromCourse(course) {
  const u = course?.units;
  if (u == null || u === '') return 3;
  const n = parseFloat(String(u));
  return Number.isFinite(n) ? n : 3;
}

function levelFromCareer(career) {
  const c = (career || '').toUpperCase();
  if (c.includes('GRAD') || c === 'GR') return 'G';
  return 'U';
}

function upskedCourseFromAmisCatalogRow(row, sectionCount) {
  const code = row.course_code;
  return {
    id: code,
    title: (row.title || code).toUpperCase(),
    offering_unit_abbr: row.subject || row.acad_org || undefined,
    units_default: unitsFromCourse(row),
    language: 'ENG',
    level: levelFromCareer(row.career),
    section_count: sectionCount ?? 0,
    description: row.description || undefined,
    amis_course_id: row.course_id,
    sais_course_id: row.sais_course_id,
    requisites: Array.isArray(row.requisites) ? row.requisites : [],
    teaching_model: row.teaching_model || null,
    sem_offered: row.sem_offered || undefined,
    is_academic: row.is_academic,
  };
}

function countSectionsByAmisCourseId(classes) {
  const m = new Map();
  for (const cls of classes) {
    const cid = cls.course_id;
    if (cid == null) continue;
    m.set(cid, (m.get(cid) || 0) + 1);
  }
  return m;
}

function countSectionsByCourseCode(classes) {
  const m = new Map();
  for (const cls of classes) {
    const code = cls.course_code || cls.course?.course_code;
    if (!code) continue;
    m.set(code, (m.get(code) || 0) + 1);
  }
  return m;
}

/**
 * Merge `{ courses: { data, current_page } }` JSON files; dedupe by `course_id`.
 */
function mergePaginatedAmisCourses(filePaths) {
  const parsed = filePaths.map((p) => JSON.parse(fs.readFileSync(p, 'utf8')));
  parsed.sort(
    (a, b) => (a.courses?.current_page || 0) - (b.courses?.current_page || 0)
  );
  const seen = new Map();
  for (const j of parsed) {
    const rows = j.courses?.data || [];
    for (const row of rows) {
      const id = row.course_id;
      if (id == null) continue;
      if (!seen.has(id)) seen.set(id, row);
    }
  }
  return [...seen.values()].sort((a, b) => String(a.course_code).localeCompare(String(b.course_code)));
}

function countOrphanCourseCodesNotInCatalog(catalogRows, classes) {
  if (!Array.isArray(catalogRows) || catalogRows.length === 0) return 0;
  const catalogCodes = new Set(catalogRows.map((r) => r.course_code));
  const missing = new Set();
  for (const cls of classes) {
    const code = cls.course_code || cls.course?.course_code;
    if (!code) continue;
    if (!catalogCodes.has(code)) missing.add(code);
  }
  return missing.size;
}

/**
 * @param {object} params
 * @param {object} params.merged - parsed uplb-amis-classes-merged.json
 * @param {string} params.semesterId - e.g. uplb-2026-1
 * @param {string} [params.sourceLabel]
 * @param {object[]|null} [params.mergedCourseCatalogRows] - merged `/api/.../courses` pages (full catalog); join on `course_id`
 */
function buildUplbUpskedArtifacts({ merged, semesterId, sourceLabel, mergedCourseCatalogRows }) {
  const classes = merged?.classes?.data;
  if (!Array.isArray(classes)) {
    throw new Error('Expected merged.classes.data array');
  }

  const termId = classes[0]?.term_id ?? 'unknown';
  const sectionCountByCourseId = countSectionsByAmisCourseId(classes);

  let courses;
  const deptCodes = new Set();

  if (Array.isArray(mergedCourseCatalogRows) && mergedCourseCatalogRows.length > 0) {
    for (const row of mergedCourseCatalogRows) {
      deptCodes.add(row.subject || row.acad_org || 'UPLB');
    }
    for (const cls of classes) {
      deptCodes.add(cls.course?.subject || cls.course?.acad_org || cls.acad_org || 'UPLB');
    }
    courses = mergedCourseCatalogRows.map((row) =>
      upskedCourseFromAmisCatalogRow(row, sectionCountByCourseId.get(row.course_id) ?? 0)
    );
    const courseByCode = new Map(courses.map((c) => [c.id, c]));
    for (const cls of classes) {
      const c = cls.course;
      const code = cls.course_code || c?.course_code;
      if (!code) continue;
      if (!courseByCode.has(code)) {
        courseByCode.set(code, {
          id: code,
          title: (c?.title || code).toUpperCase(),
          offering_unit_abbr: c?.subject || c?.acad_org || cls.acad_org || undefined,
          units_default: unitsFromCourse(c),
          language: 'ENG',
          level: levelFromCareer(c?.career),
          section_count: sectionCountByCourseId.get(cls.course_id) ?? 0,
        });
      }
    }
    courses = [...courseByCode.values()].sort((a, b) => a.id.localeCompare(b.id));
  } else {
    const sectionCountByCourseCode = countSectionsByCourseCode(classes);
    const courseMap = new Map();
    for (const cls of classes) {
      const c = cls.course;
      const code = cls.course_code || c?.course_code;
      if (!code) continue;

      deptCodes.add(c?.acad_org || cls.acad_org || 'UPLB');

      if (!courseMap.has(code)) {
        courseMap.set(code, {
          id: code,
          title: (c?.title || code).toUpperCase(),
          offering_unit_abbr: c?.subject || c?.acad_org || cls.acad_org || undefined,
          units_default: unitsFromCourse(c),
          language: 'ENG',
          level: levelFromCareer(c?.career),
          section_count: sectionCountByCourseCode.get(code) ?? 0,
        });
      }
    }
    courses = [...courseMap.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  const departments = [...deptCodes]
    .sort()
    .map((code) => ({ code, name: code }));

  const sections = [];
  const schedules = [];

  for (const cls of classes) {
    const c = cls.course;
    const courseId = cls.course_code || c?.course_code;
    if (!courseId) continue;

    const classCode = buildClassCode(cls, termId);
    const instructor = instructorFromClass(cls);
    const remarksParts = [];
    if (cls.activity) remarksParts.push(cls.activity);
    remarksParts.push(`Max: ${cls.max_class_size} | Enrolled: ${cls.active_class_size} | ${cls.status || ''}`);
    const remarks = remarksParts.filter(Boolean).join(' · ') || '~';

    const slotsTotal = typeof cls.max_class_size === 'number' ? cls.max_class_size : null;
    const slotsAvail =
      typeof cls.max_class_size === 'number' && typeof cls.active_class_size === 'number'
        ? Math.max(0, cls.max_class_size - cls.active_class_size)
        : null;

    sections.push({
      class_code: classCode,
      course_id: courseId,
      semester_id: semesterId,
      section_code: cls.section || '--',
      credits: cls.credit != null ? cls.credit : unitsFromCourse(c),
      instructor: instructor || undefined,
      remarks,
      enlisting_unit: c?.subject || c?.acad_org || cls.acad_org || undefined,
      slots_available: slotsAvail,
      slots_total: slotsTotal,
      is_overbooked: slotsAvail === 0 && (cls.active_class_size ?? 0) >= (cls.max_class_size ?? 0),
      is_dissolved: String(cls.status || '').toLowerCase() !== 'active',
      demand: 0,
      restrictions: null,
      parent_class_code: null,
      language: 'ENG',
      level: levelFromCareer(c?.career),
      delivery_mode: null,
    });

    for (const block of iterScheduleBlocks(cls)) {
      const schedule_raw = `${block.day} ${block.time_start?.slice(0, 5)}-${block.time_end?.slice(0, 5)}`;
      schedules.push({
        section_class_code: classCode,
        day: block.day,
        time_start: block.time_start,
        time_end: block.time_end,
        room: block.room || undefined,
        class_type: block.class_type,
        schedule_raw,
      });
    }
  }

  const meta = {
    source: sourceLabel || 'uplb-amis-api',
    scrapedAt: new Date().toISOString(),
    term_id: termId,
    semester_id: semesterId,
    terms: [semesterId],
    totalSections: sections.length,
    uniqueCourses: courses.length,
    courseCatalogRows: Array.isArray(mergedCourseCatalogRows) ? mergedCourseCatalogRows.length : null,
    orphan_course_codes_not_in_catalog:
      Array.isArray(mergedCourseCatalogRows) && mergedCourseCatalogRows.length > 0
        ? countOrphanCourseCodesNotInCatalog(mergedCourseCatalogRows, classes)
        : null,
    departmentsWithData: departments.length,
    scheduleRows: schedules.length,
    merged_at: merged?.classes?.merged_at,
    merged_from_files: merged?.classes?.merged_from_files,
  };

  return { courses, departments, sections, schedules, metadata: meta };
}

function buildProgramsUpsked(programsPayload) {
  const data = programsPayload?.programs?.data;
  if (!Array.isArray(data)) return [];
  return data
    .map((p) => ({
      id: `uplb:${p.program_id}`,
      program_id: p.program_id,
      acronym: p.acronym,
      title: p.title,
      career: p.career,
      college: p.college,
      degree_id: p.degree_id,
      max_units: p.max_units,
      description: p.description,
    }))
    .sort((a, b) => a.acronym.localeCompare(b.acronym));
}

function writeBundle(outDir, bundle) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'courses.json'), JSON.stringify(bundle.courses, null, 2));
  fs.writeFileSync(path.join(outDir, 'departments.json'), JSON.stringify(bundle.departments, null, 2));
  fs.writeFileSync(path.join(outDir, 'sections-upsked.json'), JSON.stringify(bundle.sections, null, 2));
  fs.writeFileSync(path.join(outDir, 'schedules-upsked.json'), JSON.stringify(bundle.schedules, null, 2));
  fs.writeFileSync(path.join(outDir, 'metadata.json'), JSON.stringify(bundle.metadata, null, 2));
  if (bundle.programs != null) {
    fs.writeFileSync(path.join(outDir, 'programs.json'), JSON.stringify(bundle.programs, null, 2));
  }
}

module.exports = {
  buildUplbUpskedArtifacts,
  writeBundle,
  buildClassCode,
  parseTimeToHHMMSS,
  buildProgramsUpsked,
  upskedCourseFromAmisCatalogRow,
  mergePaginatedAmisCourses,
  countSectionsByAmisCourseId,
  countSectionsByCourseCode,
};
