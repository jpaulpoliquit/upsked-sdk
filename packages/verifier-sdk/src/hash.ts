import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import type { ArtifactRef } from "../../schema/src/index.js";

export async function sha256File(filePath: string): Promise<string> {
  const content = await readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

export function sha256String(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function computeReleaseIdFromArtifacts(
  artifacts: Array<Pick<ArtifactRef, "key" | "sha256">>,
): string {
  const fingerprint = artifacts
    .slice()
    .sort((left, right) => left.key.localeCompare(right.key))
    .map((artifact) => `${artifact.key}:${artifact.sha256}`)
    .join("|");

  return sha256String(fingerprint).slice(0, 20);
}
