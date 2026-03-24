import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { BuildManifestConfig } from "../../../packages/verifier-sdk/src/builder.js";
import {
  buildManifestFromLocalArtifacts,
  verifyReleaseBundle,
} from "../../../packages/verifier-sdk/src/index.js";

const DEFAULT_BUNDLE_DIR = fileURLToPath(
  new URL("../../../fixtures/upb/sample-release/", import.meta.url),
);
const DEFAULT_PREVIOUS_BUNDLE_DIR = fileURLToPath(
  new URL("../../../fixtures/upb/previous-release/", import.meta.url),
);

async function loadConfig(bundleDir: string): Promise<BuildManifestConfig> {
  const configPath = join(bundleDir, "fixture.config.json");
  return JSON.parse(await readFile(configPath, "utf8")) as BuildManifestConfig;
}

async function main(): Promise<void> {
  const bundleDir = resolve(process.argv[2] ?? DEFAULT_BUNDLE_DIR);
  const previousBundleDir = resolve(process.argv[3] ?? DEFAULT_PREVIOUS_BUNDLE_DIR);

  const config = await loadConfig(bundleDir);
  const manifest = await buildManifestFromLocalArtifacts(bundleDir, config);
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  // verifyReleaseBundle reads manifest.json — write the built manifest there first
  await writeFile(join(bundleDir, "manifest.json"), manifestText, "utf8");
  await writeFile(join(bundleDir, "manifest.generated.json"), manifestText, "utf8");

  const report = await verifyReleaseBundle(bundleDir, { previousBundleDir });
  await writeFile(
    join(bundleDir, "report.generated.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );

  console.log(`Bundle: ${bundleDir}`);
  console.log(`Previous: ${previousBundleDir}`);
  console.log(
    `Verifier summary: ${report.summary.errorCount} errors, ${report.summary.warningCount} warnings`,
  );

  process.exit(report.summary.blocking ? 1 : 0);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
