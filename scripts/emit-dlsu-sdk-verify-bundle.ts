/**
 * Emit `fixtures/dlsu/mls-ay2526-t2-sdk-verify/` from the Upsked scraper bundle so
 * `npm run verify -- fixtures/dlsu/mls-ay2526-t2-sdk-verify` can run.
 *
 *   cd interop-repo && npx tsx scripts/emit-dlsu-sdk-verify-bundle.ts
 */
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { SectionStatus } from "../packages/schema/src/index.js";
import { buildManifestFromLocalArtifacts } from "../packages/verifier-sdk/src/builder.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "fixtures/dlsu/mls-ay2526-t2-upsked-bundle");
const OUT = join(ROOT, "fixtures/dlsu/mls-ay2526-t2-sdk-verify");
const SEMESTER_ID = "dlsu-2025-2";

type UpskedSection = {
  class_code?: string;
  course_id?: string;
  semester_id?: string;
  section_code?: string;
  is_overbooked?: boolean;
  is_dissolved?: boolean;
  slots_available?: number;
  slots_total?: number;
};

type UpskedSched = {
  section_class_code?: string;
  day?: string;
  time_start?: string;
  time_end?: string;
  room?: string;
};

function sectionStatus(s: UpskedSection): SectionStatus {
  if (s.is_dissolved) return "dissolved";
  if (s.is_overbooked) return "closed";
  return "open";
}

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  await copyFile(join(SRC, "courses.json"), join(OUT, "courses.json"));

  const sectionsRaw = JSON.parse(
    await readFile(join(SRC, "sections.json"), "utf8"),
  ) as UpskedSection[];
  const sections = sectionsRaw.map((s) => ({
    id: `dlsu-sec-${String(s.class_code ?? "").trim()}`,
    classCode: String(s.class_code ?? "").trim(),
    courseId: String(s.course_id ?? "").trim(),
    sectionCode: String(s.section_code ?? "").trim(),
    semesterId: String(s.semester_id ?? SEMESTER_ID).trim(),
    status: sectionStatus(s),
    ...(typeof s.slots_available === "number" ? { slotsAvailable: s.slots_available } : {}),
    ...(typeof s.slots_total === "number" ? { slotsTotal: s.slots_total } : {}),
  }));

  const schedRaw = JSON.parse(
    await readFile(join(SRC, "schedules-upsked.json"), "utf8"),
  ) as UpskedSched[];
  const schedules = schedRaw.map((z, i) => ({
    id: `dlsu-sch-${String(z.section_class_code ?? "").trim()}-${String(z.day ?? "").trim()}-${String(z.time_start ?? "").trim()}-${i}`,
    classCode: String(z.section_class_code ?? "").trim(),
    day: z.day,
    timeStart: String(z.time_start ?? "").trim(),
    timeEnd: String(z.time_end ?? "").trim(),
    ...(z.room != null && String(z.room).trim() ? { room: String(z.room).trim() } : {}),
  }));

  const metaSrc = JSON.parse(await readFile(join(SRC, "metadata.json"), "utf8")) as Record<
    string,
    unknown
  >;
  const scrapedAt =
    typeof metaSrc.scrapedAt === "string" ? metaSrc.scrapedAt : new Date().toISOString();
  const metadata = {
    ...metaSrc,
    generatedAt: new Date().toISOString(),
    connectorVersion: "0.1.0",
    sourceType: "partner_connector",
    sourcePublishedAt: scrapedAt,
  };

  await writeFile(join(OUT, "sections.json"), `${JSON.stringify(sections, null, 2)}\n`);
  await writeFile(join(OUT, "schedules.json"), `${JSON.stringify(schedules, null, 2)}\n`);
  await writeFile(join(OUT, "metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`);

  const manifest = await buildManifestFromLocalArtifacts(OUT, {
    universityId: "dlsu",
    semesterId: SEMESTER_ID,
    sourceType: "partner_connector",
    catalogSourceId: "dlsu-mls-catalog",
    connectorId: "dlsu.experimental.mls",
    connectorVersion: "0.1.0",
    trustTier: "community",
    publishedAt: new Date().toISOString(),
    sourcePublishedAt: scrapedAt,
  });
  await writeFile(join(OUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote ${OUT} releaseId=${manifest.releaseId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
