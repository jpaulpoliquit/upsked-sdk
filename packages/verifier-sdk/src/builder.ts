import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import { ARTIFACT_KIND_TO_DEFAULT_FILE, SCHEMA_VERSION } from "../../schema/src/index.js";
import type {
  ArtifactKind,
  ArtifactRef,
  ReleaseCounts,
  ReleaseManifest,
  SourceType,
  TrustTier,
} from "../../schema/src/index.js";
import { computeReleaseIdFromArtifacts, sha256File } from "./hash.js";

interface ArtifactDefinition {
  key: string;
  kind: ArtifactKind;
  fileName: string;
  contentType: string;
}

export interface BuildManifestConfig {
  universityId: string;
  semesterId: string;
  releaseId?: string;
  schemaVersion?: number;
  sourceType: SourceType;
  catalogSourceId: string;
  connectorId: string;
  connectorVersion: string;
  trustTier: TrustTier;
  publishedAt: string;
  sourcePublishedAt?: string;
  previousReleaseId?: string;
  counts?: Partial<ReleaseCounts>;
}

const ARTIFACT_DEFS: ArtifactDefinition[] = [
  {
    key: "courses",
    kind: "courses_json",
    fileName: "courses.json",
    contentType: "application/json",
  },
  {
    key: "courses_pbf",
    kind: "courses_pbf",
    fileName: "courses.pbf",
    contentType: "application/x-protobuf",
  },
  {
    key: "sections",
    kind: "sections_json",
    fileName: "sections.json",
    contentType: "application/json",
  },
  {
    key: "schedules",
    kind: "schedules_json",
    fileName: "schedules.json",
    contentType: "application/json",
  },
  {
    key: "metadata",
    kind: "metadata_json",
    fileName: "metadata.json",
    contentType: "application/json",
  },
  {
    key: "programs",
    kind: "programs_json",
    fileName: "programs.json",
    contentType: "application/json",
  },
  {
    key: "rooms",
    kind: "rooms_json",
    fileName: "rooms.json",
    contentType: "application/json",
  },
  {
    key: "raw_payload_index",
    kind: "raw_payload_index_json",
    fileName: "raw_payload_index.json",
    contentType: "application/json",
  },
  {
    key: "validation_report",
    kind: "validation_report_json",
    fileName: "validation_report.json",
    contentType: "application/json",
  },
];

async function readJsonMaybe(filePath: string): Promise<unknown> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as unknown;
}

async function buildArtifact(
  bundleDir: string,
  artifactDef: ArtifactDefinition,
): Promise<ArtifactRef> {
  const absolutePath = join(bundleDir, artifactDef.fileName);
  const fileStat = await stat(absolutePath);
  const sha256 = await sha256File(absolutePath);

  let recordCount: number | undefined;
  if (artifactDef.contentType === "application/json") {
    const json = await readJsonMaybe(absolutePath);
    if (Array.isArray(json)) {
      recordCount = json.length;
    } else if (json != null && typeof json === "object") {
      recordCount = 1;
    }
  }

  return {
    key: artifactDef.key,
    kind: artifactDef.kind,
    path: artifactDef.fileName,
    sha256,
    sizeBytes: fileStat.size,
    contentType: artifactDef.contentType,
    compression: "identity",
    ...(recordCount !== undefined ? { recordCount } : {}),
  };
}

export async function buildManifestFromLocalArtifacts(
  bundleDir: string,
  config: BuildManifestConfig,
): Promise<ReleaseManifest> {
  const artifacts: ArtifactRef[] = [];

  for (const artifactDef of ARTIFACT_DEFS) {
    try {
      const artifact = await buildArtifact(bundleDir, artifactDef);
      artifacts.push(artifact);
    } catch {
      continue;
    }
  }

  if (artifacts.length === 0) {
    throw new Error(`No known artifacts found in ${bundleDir}`);
  }

  const artifactByKind = new Map<ArtifactKind, ArtifactRef>(
    artifacts.map((artifact) => [artifact.kind, artifact]),
  );
  const counts: ReleaseCounts = {
    courses: artifactByKind.get("courses_json")?.recordCount ?? config.counts?.courses ?? 0,
    sections: artifactByKind.get("sections_json")?.recordCount ?? config.counts?.sections ?? 0,
    schedules: artifactByKind.get("schedules_json")?.recordCount ?? config.counts?.schedules ?? 0,
    ...(artifactByKind.get("programs_json")?.recordCount !== undefined
      ? { programs: artifactByKind.get("programs_json")?.recordCount }
      : {}),
    ...(artifactByKind.get("rooms_json")?.recordCount !== undefined
      ? { rooms: artifactByKind.get("rooms_json")?.recordCount }
      : {}),
  };

  const releaseId = config.releaseId ?? computeReleaseIdFromArtifacts(artifacts);

  return {
    universityId: config.universityId,
    semesterId: config.semesterId,
    releaseId,
    schemaVersion: config.schemaVersion ?? SCHEMA_VERSION,
    sourceType: config.sourceType,
    catalogSourceId: config.catalogSourceId,
    connectorId: config.connectorId,
    connectorVersion: config.connectorVersion,
    trustTier: config.trustTier,
    publishedAt: config.publishedAt,
    ...(config.sourcePublishedAt ? { sourcePublishedAt: config.sourcePublishedAt } : {}),
    ...(config.previousReleaseId ? { previousReleaseId: config.previousReleaseId } : {}),
    counts,
    artifacts,
  };
}

export function artifactFileNameForKind(kind: ArtifactKind): string | null {
  return ARTIFACT_KIND_TO_DEFAULT_FILE[kind] ?? null;
}
