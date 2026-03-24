import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import type { ReleaseManifest, ScheduleRow } from "../../../schema/src/index.js";
import { buildManifestFromLocalArtifacts } from "../builder.js";
import { verifyReleaseBundle } from "../verifier.js";

async function withTempBundleCopy<T>(
  sourceDir: string,
  callback: (tempDir: string) => Promise<T>,
): Promise<T> {
  const tempDir = await mkdtemp(join(tmpdir(), "upsked-sdk-"));
  await cp(sourceDir, tempDir, { recursive: true });
  try {
    return await callback(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const previousBundleDir = fileURLToPath(
    new URL("../../../../fixtures/upb/previous-release/", import.meta.url),
  );
  const sampleBundleDir = fileURLToPath(
    new URL("../../../../fixtures/upb/sample-release/", import.meta.url),
  );

  const cleanReport = await verifyReleaseBundle(sampleBundleDir, {
    previousBundleDir,
  });

  assert.equal(cleanReport.summary.blocking, false, "sample release should verify cleanly");
  assert.equal(cleanReport.summary.warningCount, 0, "sample release should not emit warnings");
  assert.equal(cleanReport.metrics.courses, 2);
  assert.equal(cleanReport.metrics.sections, 4);
  assert.equal(cleanReport.metrics.schedules, 6);
  assert.equal(cleanReport.regression?.previousReleaseId != null, true);

  await withTempBundleCopy(sampleBundleDir, async (tempDir) => {
    const schedulesPath = join(tempDir, "schedules.json");
    const schedules = JSON.parse(await readFile(schedulesPath, "utf8")) as ScheduleRow[];
    schedules[0] = {
      ...schedules[0],
      sectionId: "missing-section",
      classCode: "missing-class-code",
      timeEnd: "08:00",
    };
    await writeFile(schedulesPath, `${JSON.stringify(schedules, null, 2)}\n`, "utf8");

    const manifestConfigPath = join(tempDir, "fixture.config.json");
    const config = JSON.parse(await readFile(manifestConfigPath, "utf8")) as Record<
      string,
      unknown
    >;
    const currentManifest = JSON.parse(
      await readFile(join(tempDir, "manifest.json"), "utf8"),
    ) as ReleaseManifest;
    const nextManifest = await buildManifestFromLocalArtifacts(tempDir, {
      universityId: String(config.universityId),
      semesterId: String(config.semesterId),
      schemaVersion: Number(config.schemaVersion ?? currentManifest.schemaVersion),
      sourceType: currentManifest.sourceType,
      catalogSourceId: String(config.catalogSourceId),
      connectorId: String(config.connectorId),
      connectorVersion: String(config.connectorVersion),
      trustTier: currentManifest.trustTier,
      publishedAt: String(config.publishedAt),
      sourcePublishedAt:
        typeof config.sourcePublishedAt === "string" ? config.sourcePublishedAt : undefined,
      previousReleaseId: currentManifest.previousReleaseId,
    });
    await writeFile(
      join(tempDir, "manifest.json"),
      `${JSON.stringify(nextManifest, null, 2)}\n`,
      "utf8",
    );

    const brokenReport = await verifyReleaseBundle(tempDir, {
      previousBundleDir,
    });
    assert.equal(brokenReport.summary.blocking, true, "broken fixture should block promotion");
    assert.equal(
      brokenReport.issues.some((issue) => issue.code === "referential.schedule_section_missing"),
      true,
      "broken fixture should report missing section references",
    );
    assert.equal(
      brokenReport.issues.some((issue) => issue.code === "semantic.invalid_schedule_time_range"),
      true,
      "broken fixture should report invalid time ranges",
    );
  });

  console.log("verifier fixture tests passed");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
