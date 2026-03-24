import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { BuildManifestConfig } from "../packages/verifier-sdk/src/builder.js";
import { buildManifestFromLocalArtifacts } from "../packages/verifier-sdk/src/builder.js";

interface FixtureConfig extends BuildManifestConfig {
  previousFixtureDir?: string;
}

const FIXTURE_DIRS = ["fixtures/uplb/previous-release", "fixtures/uplb/sample-release"] as const;
const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));

async function readFixtureConfig(bundleDir: string): Promise<FixtureConfig> {
  const configPath = join(bundleDir, "fixture.config.json");
  return JSON.parse(await readFile(configPath, "utf8")) as FixtureConfig;
}

async function resolvePreviousReleaseId(
  bundleDir: string,
  config: FixtureConfig,
): Promise<string | undefined> {
  if (config.previousReleaseId) {
    return config.previousReleaseId;
  }
  if (!config.previousFixtureDir) {
    return undefined;
  }
  const previousBundleDir = resolve(bundleDir, config.previousFixtureDir);
  const previousManifestPath = join(previousBundleDir, "manifest.json");
  const previousManifest = JSON.parse(await readFile(previousManifestPath, "utf8")) as {
    releaseId?: string;
  };
  return previousManifest.releaseId;
}

async function main(): Promise<void> {
  for (const relativeDir of FIXTURE_DIRS) {
    const bundleDir = resolve(REPO_ROOT, relativeDir);
    const config = await readFixtureConfig(bundleDir);
    const previousReleaseId = await resolvePreviousReleaseId(bundleDir, config);
    const manifest = await buildManifestFromLocalArtifacts(bundleDir, {
      ...config,
      ...(previousReleaseId ? { previousReleaseId } : {}),
    });
    await writeFile(
      join(bundleDir, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8",
    );
    console.log(`synced ${relativeDir}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
