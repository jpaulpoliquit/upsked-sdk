export const SCHEMA_VERSION = 1 as const;

export const ARTIFACT_KIND_TO_DEFAULT_FILE = {
  courses_json: "courses.json",
  courses_pbf: "courses.pbf",
  sections_json: "sections.json",
  schedules_json: "schedules.json",
  metadata_json: "metadata.json",
  programs_json: "programs.json",
  rooms_json: "rooms.json",
  raw_payload_index_json: "raw_payload_index.json",
  validation_report_json: "validation_report.json",
} as const;

export type ArtifactKind = keyof typeof ARTIFACT_KIND_TO_DEFAULT_FILE;

export const REQUIRED_ARTIFACT_KINDS = [
  "sections_json",
  "schedules_json",
  "metadata_json",
] as const satisfies readonly ArtifactKind[];

export const SOURCE_TYPES = [
  "scraper",
  "official_api",
  "partner_connector",
  "managed_import",
  "local_bundle",
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

export const TRUST_TIERS = ["community", "verified_partner", "managed"] as const;

export type TrustTier = (typeof TRUST_TIERS)[number];

export const COMPRESSIONS = ["identity", "gzip", "zstd"] as const;

export type CompressionKind = (typeof COMPRESSIONS)[number];

export const DAYS = ["M", "T", "W", "TH", "F", "S", "SU"] as const;

export type ScheduleDay = (typeof DAYS)[number];

export const SECTION_STATUSES = ["open", "closed", "cancelled", "dissolved", "tba"] as const;

export type SectionStatus = (typeof SECTION_STATUSES)[number];

export const CLASS_TYPES = ["lec", "lab", "rec", "sem", "other"] as const;

export type ClassType = (typeof CLASS_TYPES)[number];

export const VALID_SOURCE_TYPES = new Set<SourceType>(SOURCE_TYPES);
export const VALID_TRUST_TIERS = new Set<TrustTier>(TRUST_TIERS);
export const VALID_ARTIFACT_KINDS = new Set<ArtifactKind>(
  Object.keys(ARTIFACT_KIND_TO_DEFAULT_FILE) as ArtifactKind[],
);
export const VALID_COMPRESSIONS = new Set<CompressionKind>(COMPRESSIONS);
export const VALID_DAYS = new Set<ScheduleDay>(DAYS);
export const VALID_SECTION_STATUSES = new Set<SectionStatus>(SECTION_STATUSES);
export const VALID_CLASS_TYPES = new Set<ClassType>(CLASS_TYPES);

export interface SchemaIssue {
  path: string;
  message: string;
  entityId?: string;
}

export interface ArtifactRef {
  key: string;
  kind: ArtifactKind;
  path: string;
  sha256: string;
  sizeBytes: number;
  contentType: string;
  compression?: CompressionKind;
  recordCount?: number;
}

export interface ReleaseCounts {
  courses: number;
  sections: number;
  schedules: number;
  programs?: number;
  rooms?: number;
}

export interface ReleaseManifest {
  universityId: string;
  semesterId: string;
  releaseId: string;
  schemaVersion: number;
  sourceType: SourceType;
  catalogSourceId: string;
  connectorId: string;
  connectorVersion: string;
  trustTier: TrustTier;
  publishedAt: string;
  sourcePublishedAt?: string;
  previousReleaseId?: string;
  counts: ReleaseCounts;
  artifacts: ArtifactRef[];
}

export interface CourseRow {
  id: string;
  title: string;
  offeringUnit?: string;
  unitsDefault?: number;
  [key: string]: unknown;
}

export interface SectionRow {
  id: string;
  classCode: string;
  courseId: string;
  sectionCode: string;
  semesterId: string;
  status?: SectionStatus;
  parentSectionId?: string;
  slotsAvailable?: number;
  slotsTotal?: number;
  offeringUnit?: string;
  [key: string]: unknown;
}

export interface ScheduleRow {
  id: string;
  sectionId?: string;
  classCode?: string;
  day: ScheduleDay;
  timeStart: string;
  timeEnd: string;
  classType?: ClassType;
  room?: string;
  [key: string]: unknown;
}

export interface MetadataRecord {
  generatedAt: string;
  connectorVersion: string;
  sourceType: SourceType | string;
  sourcePublishedAt?: string;
  rawPayloadCount?: number;
  [key: string]: unknown;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoDateTime(value: unknown): value is string {
  return (
    isNonEmptyString(value) &&
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}

function isSafeInteger(
  value: unknown,
  { min = 0, allowZero = true }: { min?: number; allowZero?: boolean } = {},
): value is number {
  return (
    Number.isInteger(value) && (value as number) >= min && (allowZero || (value as number) !== 0)
  );
}

function pushIssue(
  issues: SchemaIssue[],
  path: string,
  message: string,
  extra: Omit<SchemaIssue, "path" | "message"> = {},
): void {
  issues.push({ path, message, ...extra });
}

export function validateManifest(manifest: unknown): SchemaIssue[] {
  const issues: SchemaIssue[] = [];

  if (!isPlainObject(manifest)) {
    pushIssue(issues, "", "Manifest must be an object");
    return issues;
  }

  if (
    !isNonEmptyString(manifest.universityId) ||
    !/^[a-z0-9][a-z0-9_-]*$/i.test(manifest.universityId)
  ) {
    pushIssue(issues, "universityId", "universityId must be a non-empty slug");
  }

  if (!isNonEmptyString(manifest.semesterId)) {
    pushIssue(issues, "semesterId", "semesterId is required");
  }

  if (
    !isNonEmptyString(manifest.releaseId) ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(manifest.releaseId)
  ) {
    pushIssue(issues, "releaseId", "releaseId must be a non-empty content-derived id");
  }

  if (!isSafeInteger(manifest.schemaVersion, { min: 1, allowZero: false })) {
    pushIssue(issues, "schemaVersion", "schemaVersion must be a positive integer");
  }

  if (!VALID_SOURCE_TYPES.has(manifest.sourceType as SourceType)) {
    pushIssue(
      issues,
      "sourceType",
      `sourceType must be one of: ${Array.from(VALID_SOURCE_TYPES).join(", ")}`,
    );
  }

  for (const field of ["catalogSourceId", "connectorId", "connectorVersion"] as const) {
    if (!isNonEmptyString(manifest[field])) {
      pushIssue(issues, field, `${field} is required`);
    }
  }

  if (!VALID_TRUST_TIERS.has(manifest.trustTier as TrustTier)) {
    pushIssue(
      issues,
      "trustTier",
      `trustTier must be one of: ${Array.from(VALID_TRUST_TIERS).join(", ")}`,
    );
  }

  if (!isIsoDateTime(manifest.publishedAt)) {
    pushIssue(issues, "publishedAt", "publishedAt must be an ISO-8601 datetime");
  }

  if (manifest.sourcePublishedAt != null && !isIsoDateTime(manifest.sourcePublishedAt)) {
    pushIssue(issues, "sourcePublishedAt", "sourcePublishedAt must be an ISO-8601 datetime");
  }

  if (manifest.previousReleaseId != null && !isNonEmptyString(manifest.previousReleaseId)) {
    pushIssue(
      issues,
      "previousReleaseId",
      "previousReleaseId must be a non-empty string when provided",
    );
  }

  const counts = manifest.counts;
  if (!isPlainObject(counts)) {
    pushIssue(issues, "counts", "counts must be an object");
  } else {
    for (const field of ["courses", "sections", "schedules"] as const) {
      if (!isSafeInteger(counts[field], { min: 0, allowZero: true })) {
        pushIssue(issues, `counts.${field}`, `${field} count must be an integer`);
      }
    }
    for (const field of ["programs", "rooms"] as const) {
      if (counts[field] != null && !isSafeInteger(counts[field], { min: 0 })) {
        pushIssue(issues, `counts.${field}`, `${field} count must be a non-negative integer`);
      }
    }
  }

  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length === 0) {
    pushIssue(issues, "artifacts", "artifacts must be a non-empty array");
    return issues;
  }

  const seenKeys = new Set<string>();
  const seenKinds = new Set<ArtifactKind>();

  manifest.artifacts.forEach((artifact, index) => {
    const basePath = `artifacts[${index}]`;
    if (!isPlainObject(artifact)) {
      pushIssue(issues, basePath, "artifact must be an object");
      return;
    }

    if (!isNonEmptyString(artifact.key) || !/^[a-z0-9_]+$/i.test(artifact.key)) {
      pushIssue(issues, `${basePath}.key`, "artifact key must be a non-empty slug");
    } else if (seenKeys.has(artifact.key)) {
      pushIssue(issues, `${basePath}.key`, `duplicate artifact key "${artifact.key}"`);
    } else {
      seenKeys.add(artifact.key);
    }

    const artifactKind = artifact.kind as ArtifactKind;
    if (!VALID_ARTIFACT_KINDS.has(artifactKind)) {
      pushIssue(issues, `${basePath}.kind`, `invalid artifact kind "${String(artifact.kind)}"`);
    } else if (seenKinds.has(artifactKind)) {
      pushIssue(issues, `${basePath}.kind`, `duplicate artifact kind "${artifactKind}"`);
    } else {
      seenKinds.add(artifactKind);
    }

    if (!isNonEmptyString(artifact.path)) {
      pushIssue(issues, `${basePath}.path`, "artifact path is required");
    }

    if (!isSha256(artifact.sha256)) {
      pushIssue(issues, `${basePath}.sha256`, "artifact sha256 must be a 64-char hex digest");
    }

    if (!isSafeInteger(artifact.sizeBytes, { min: 1, allowZero: false })) {
      pushIssue(issues, `${basePath}.sizeBytes`, "artifact sizeBytes must be a positive integer");
    }

    if (!isNonEmptyString(artifact.contentType)) {
      pushIssue(issues, `${basePath}.contentType`, "artifact contentType is required");
    }

    if (
      artifact.compression != null &&
      !VALID_COMPRESSIONS.has(artifact.compression as CompressionKind)
    ) {
      pushIssue(
        issues,
        `${basePath}.compression`,
        `invalid compression "${String(artifact.compression)}"`,
      );
    }

    if (artifact.recordCount != null && !isSafeInteger(artifact.recordCount, { min: 0 })) {
      pushIssue(
        issues,
        `${basePath}.recordCount`,
        "artifact recordCount must be a non-negative integer",
      );
    }
  });

  const hasCoursesArtifact = seenKinds.has("courses_json") || seenKinds.has("courses_pbf");
  if (!hasCoursesArtifact) {
    pushIssue(issues, "artifacts", "a release must include either courses_json or courses_pbf");
  }

  for (const requiredKind of REQUIRED_ARTIFACT_KINDS) {
    if (!seenKinds.has(requiredKind)) {
      pushIssue(issues, "artifacts", `missing required artifact kind "${requiredKind}"`);
    }
  }

  const programsCount =
    isPlainObject(counts) && typeof counts.programs === "number" ? counts.programs : 0;
  const roomsCount = isPlainObject(counts) && typeof counts.rooms === "number" ? counts.rooms : 0;

  if (programsCount > 0 && !seenKinds.has("programs_json")) {
    pushIssue(
      issues,
      "counts.programs",
      "programs_json is required when counts.programs is greater than zero",
    );
  }

  if (roomsCount > 0 && !seenKinds.has("rooms_json")) {
    pushIssue(
      issues,
      "counts.rooms",
      "rooms_json is required when counts.rooms is greater than zero",
    );
  }

  return issues;
}

export function validateCourseRows(rows: unknown): SchemaIssue[] {
  const issues: SchemaIssue[] = [];
  if (!Array.isArray(rows)) {
    pushIssue(issues, "courses", "courses.json must contain an array");
    return issues;
  }

  rows.forEach((course, index) => {
    const basePath = `courses[${index}]`;
    if (!isPlainObject(course)) {
      pushIssue(issues, basePath, "course must be an object");
      return;
    }
    if (!isNonEmptyString(course.id)) {
      pushIssue(issues, `${basePath}.id`, "course id is required");
    }
    if (!isNonEmptyString(course.title)) {
      pushIssue(issues, `${basePath}.title`, "course title is required", {
        entityId: typeof course.id === "string" ? course.id : undefined,
      });
    }
    if (course.offeringUnit != null && !isNonEmptyString(course.offeringUnit)) {
      pushIssue(issues, `${basePath}.offeringUnit`, "offeringUnit must be a non-empty string");
    }
    if (course.unitsDefault != null && typeof course.unitsDefault !== "number") {
      pushIssue(issues, `${basePath}.unitsDefault`, "unitsDefault must be numeric");
    }
  });

  return issues;
}

export function validateSectionRows(
  rows: unknown,
  manifest?: Pick<ReleaseManifest, "semesterId"> | null,
): SchemaIssue[] {
  const issues: SchemaIssue[] = [];
  if (!Array.isArray(rows)) {
    pushIssue(issues, "sections", "sections.json must contain an array");
    return issues;
  }

  rows.forEach((section, index) => {
    const basePath = `sections[${index}]`;
    if (!isPlainObject(section)) {
      pushIssue(issues, basePath, "section must be an object");
      return;
    }
    for (const field of ["id", "classCode", "courseId", "sectionCode", "semesterId"] as const) {
      if (!isNonEmptyString(section[field])) {
        pushIssue(issues, `${basePath}.${field}`, `${field} is required`);
      }
    }
    if (
      section.semesterId != null &&
      manifest?.semesterId &&
      section.semesterId !== manifest.semesterId
    ) {
      pushIssue(
        issues,
        `${basePath}.semesterId`,
        "section semesterId must match manifest semesterId",
        {
          entityId: typeof section.id === "string" ? section.id : undefined,
        },
      );
    }
    if (section.status != null && !VALID_SECTION_STATUSES.has(section.status as SectionStatus)) {
      pushIssue(
        issues,
        `${basePath}.status`,
        `invalid section status "${String(section.status)}"`,
        {
          entityId: typeof section.id === "string" ? section.id : undefined,
        },
      );
    }
    if (section.parentSectionId != null && !isNonEmptyString(section.parentSectionId)) {
      pushIssue(
        issues,
        `${basePath}.parentSectionId`,
        "parentSectionId must be a non-empty string",
      );
    }
    if (section.slotsAvailable != null && !isSafeInteger(section.slotsAvailable, { min: 0 })) {
      pushIssue(
        issues,
        `${basePath}.slotsAvailable`,
        "slotsAvailable must be a non-negative integer",
      );
    }
    if (section.slotsTotal != null && !isSafeInteger(section.slotsTotal, { min: 0 })) {
      pushIssue(issues, `${basePath}.slotsTotal`, "slotsTotal must be a non-negative integer");
    }
    if (section.offeringUnit != null && !isNonEmptyString(section.offeringUnit)) {
      pushIssue(issues, `${basePath}.offeringUnit`, "offeringUnit must be a non-empty string");
    }
  });

  return issues;
}

export function validateScheduleRows(rows: unknown): SchemaIssue[] {
  const issues: SchemaIssue[] = [];
  if (!Array.isArray(rows)) {
    pushIssue(issues, "schedules", "schedules.json must contain an array");
    return issues;
  }

  rows.forEach((schedule, index) => {
    const basePath = `schedules[${index}]`;
    if (!isPlainObject(schedule)) {
      pushIssue(issues, basePath, "schedule must be an object");
      return;
    }
    if (!isNonEmptyString(schedule.id)) {
      pushIssue(issues, `${basePath}.id`, "schedule id is required");
    }
    if (!isNonEmptyString(schedule.day) || !VALID_DAYS.has(schedule.day as ScheduleDay)) {
      pushIssue(issues, `${basePath}.day`, `invalid day "${String(schedule.day)}"`, {
        entityId: typeof schedule.id === "string" ? schedule.id : undefined,
      });
    }
    for (const field of ["timeStart", "timeEnd"] as const) {
      if (!isNonEmptyString(schedule[field])) {
        pushIssue(issues, `${basePath}.${field}`, `${field} is required`, {
          entityId: typeof schedule.id === "string" ? schedule.id : undefined,
        });
      }
    }
    if (schedule.sectionId != null && !isNonEmptyString(schedule.sectionId)) {
      pushIssue(issues, `${basePath}.sectionId`, "sectionId must be a non-empty string");
    }
    if (schedule.classCode != null && !isNonEmptyString(schedule.classCode)) {
      pushIssue(issues, `${basePath}.classCode`, "classCode must be a non-empty string");
    }
    if (!isNonEmptyString(schedule.sectionId) && !isNonEmptyString(schedule.classCode)) {
      pushIssue(issues, basePath, "schedule must reference a sectionId or classCode");
    }
    if (schedule.classType != null && !VALID_CLASS_TYPES.has(schedule.classType as ClassType)) {
      pushIssue(
        issues,
        `${basePath}.classType`,
        `invalid classType "${String(schedule.classType)}"`,
        {
          entityId: typeof schedule.id === "string" ? schedule.id : undefined,
        },
      );
    }
    if (schedule.room != null && typeof schedule.room !== "string") {
      pushIssue(issues, `${basePath}.room`, "room must be a string");
    }
  });

  return issues;
}

export function validateMetadataRecord(metadata: unknown): SchemaIssue[] {
  const issues: SchemaIssue[] = [];
  if (!isPlainObject(metadata)) {
    pushIssue(issues, "metadata", "metadata.json must contain an object");
    return issues;
  }

  if (!isIsoDateTime(metadata.generatedAt)) {
    pushIssue(issues, "metadata.generatedAt", "generatedAt must be an ISO-8601 datetime");
  }

  for (const field of ["connectorVersion", "sourceType"] as const) {
    if (!isNonEmptyString(metadata[field])) {
      pushIssue(issues, `metadata.${field}`, `${field} is required`);
    }
  }

  if (metadata.sourcePublishedAt != null && !isIsoDateTime(metadata.sourcePublishedAt)) {
    pushIssue(
      issues,
      "metadata.sourcePublishedAt",
      "sourcePublishedAt must be an ISO-8601 datetime",
    );
  }

  if (metadata.rawPayloadCount != null && !isSafeInteger(metadata.rawPayloadCount, { min: 0 })) {
    pushIssue(issues, "metadata.rawPayloadCount", "rawPayloadCount must be a non-negative integer");
  }

  return issues;
}
