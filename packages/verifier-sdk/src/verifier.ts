import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  validateCourseRows,
  validateManifest,
  validateMetadataRecord,
  validateScheduleRows,
  validateSectionRows,
} from "../../schema/src/index.js";
import type {
  ArtifactKind,
  ArtifactRef,
  CourseRow,
  MetadataRecord,
  ReleaseManifest,
  ScheduleRow,
  SchemaIssue,
  SectionRow,
} from "../../schema/src/index.js";
import { computeReleaseIdFromArtifacts, sha256File } from "./hash.js";

export const VERIFIER_VERSION = "0.1.0" as const;

export type VerifierIssueCategory =
  | "schema"
  | "identity"
  | "referential"
  | "semantic"
  | "release_integrity"
  | "regression";

export type VerifierIssueSeverity = "error" | "warning" | "info";

export interface VerifierIssue {
  code: string;
  category: VerifierIssueCategory;
  severity: VerifierIssueSeverity;
  artifactKey: string;
  path?: string;
  entityId?: string;
  message: string;
  sampleValues?: string[];
}

export interface VerifierSummary {
  errorCount: number;
  warningCount: number;
  infoCount: number;
  blocking: boolean;
  autoPromotionEligible: boolean;
}

export interface VerifierMetrics {
  courses: number;
  sections: number;
  schedules: number;
  programs?: number;
  rooms?: number;
  duplicateClassCodes?: number;
  orphanSections?: number;
  orphanSchedules?: number;
}

export interface VerifierRegression {
  previousReleaseId: string;
  courseDeltaPct?: number;
  sectionDeltaPct?: number;
  scheduleDeltaPct?: number;
  suspiciousDepartments?: string[];
}

export interface VerifierReport {
  universityId: string;
  semesterId: string;
  releaseId: string;
  schemaVersion: number;
  verifierVersion: string;
  generatedAt: string;
  summary: VerifierSummary;
  issues: VerifierIssue[];
  metrics: VerifierMetrics;
  regression?: VerifierRegression;
}

export interface VerificationThresholds {
  courseDeltaPct: number;
  sectionDeltaPct: number;
  scheduleDeltaPct: number;
}

export interface VerifyReleaseBundleOptions {
  previousBundleDir?: string;
  thresholds?: Partial<VerificationThresholds>;
}

interface LoadedArtifact {
  artifact: ArtifactRef;
  absolutePath: string;
  raw: Buffer;
  json: unknown | null;
}

interface LoadedBundle {
  manifest: ReleaseManifest;
  artifactData: Map<ArtifactKind, LoadedArtifact>;
}

const DEFAULT_THRESHOLDS: VerificationThresholds = {
  courseDeltaPct: 35,
  sectionDeltaPct: 35,
  scheduleDeltaPct: 35,
};

function toMinutes(timeValue: unknown): number | null {
  if (typeof timeValue !== "string") {
    return null;
  }
  const match = timeValue.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    return null;
  }
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (hours > 23 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
}

function addIssue(issues: VerifierIssue[], issue: VerifierIssue): void {
  issues.push(issue);
}

function mapSchemaIssues(
  issues: SchemaIssue[],
  {
    codePrefix,
    category,
    severity,
    artifactKey,
  }: {
    codePrefix: string;
    category: VerifierIssueCategory;
    severity: VerifierIssueSeverity;
    artifactKey: string;
  },
): VerifierIssue[] {
  return issues.map((issue) => ({
    code: codePrefix,
    category,
    severity,
    artifactKey,
    ...(issue.path ? { path: issue.path } : {}),
    ...(issue.entityId ? { entityId: issue.entityId } : {}),
    message: issue.message,
  }));
}

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function loadArtifact(bundleDir: string, artifact: ArtifactRef): Promise<LoadedArtifact> {
  const absolutePath = join(bundleDir, artifact.path);
  const raw = await readFile(absolutePath);
  let json: unknown | null = null;
  if (artifact.contentType === "application/json") {
    json = JSON.parse(raw.toString("utf8")) as unknown;
  }
  return { absolutePath, artifact, raw, json };
}

async function loadBundle(
  bundleDir: string,
  issues: VerifierIssue[],
  { allowPartialManifest = false }: { allowPartialManifest?: boolean } = {},
): Promise<LoadedBundle | null> {
  const manifestPath = join(bundleDir, "manifest.json");
  let manifest: ReleaseManifest;

  try {
    manifest = await readJson<ReleaseManifest>(manifestPath);
  } catch (error) {
    if (!allowPartialManifest) {
      addIssue(issues, {
        code: "schema.manifest_missing",
        category: "schema",
        severity: "error",
        artifactKey: "manifest",
        path: "manifest.json",
        message: `Failed to read manifest.json: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
    return null;
  }

  const manifestSchemaIssues = validateManifest(manifest);
  mapSchemaIssues(manifestSchemaIssues, {
    codePrefix: "schema.manifest_invalid",
    category: "schema",
    severity: "error",
    artifactKey: "manifest",
  }).forEach((issue) => addIssue(issues, issue));

  const artifactData = new Map<ArtifactKind, LoadedArtifact>();
  for (const artifact of Array.isArray(manifest.artifacts) ? manifest.artifacts : []) {
    try {
      const loaded = await loadArtifact(bundleDir, artifact);
      artifactData.set(artifact.kind, loaded);
    } catch (error) {
      addIssue(issues, {
        code: "release_integrity.artifact_missing",
        category: "release_integrity",
        severity: "error",
        artifactKey: artifact.key,
        path: artifact.path,
        message: `Missing or unreadable artifact "${artifact.path}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  }

  return { manifest, artifactData };
}

function percentDelta(current: number, previous: number): number | null {
  if (!previous) {
    return null;
  }
  return ((current - previous) / previous) * 100;
}

function summarizeIssues(issues: VerifierIssue[]): VerifierSummary {
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const infoCount = issues.filter((issue) => issue.severity === "info").length;

  return {
    errorCount,
    warningCount,
    infoCount,
    blocking: errorCount > 0,
    autoPromotionEligible: errorCount === 0 && warningCount === 0,
  };
}

export async function verifyReleaseBundle(
  bundleDir: string,
  options: VerifyReleaseBundleOptions = {},
): Promise<VerifierReport> {
  const issues: VerifierIssue[] = [];
  const thresholds: VerificationThresholds = {
    ...DEFAULT_THRESHOLDS,
    ...(options.thresholds ?? {}),
  };

  const bundle = await loadBundle(bundleDir, issues);
  if (!bundle) {
    return {
      universityId: "unknown",
      semesterId: "unknown",
      releaseId: "unknown",
      schemaVersion: 1,
      verifierVersion: VERIFIER_VERSION,
      generatedAt: new Date().toISOString(),
      summary: summarizeIssues(issues),
      issues,
      metrics: {
        courses: 0,
        sections: 0,
        schedules: 0,
      },
    };
  }

  const { manifest, artifactData } = bundle;
  const coursesJson = artifactData.get("courses_json")?.json;
  const sectionsJson = artifactData.get("sections_json")?.json;
  const schedulesJson = artifactData.get("schedules_json")?.json;
  const metadataJson = artifactData.get("metadata_json")?.json;

  mapSchemaIssues(validateCourseRows(coursesJson ?? []), {
    codePrefix: "schema.course_row_invalid",
    category: "schema",
    severity: "error",
    artifactKey: "courses",
  }).forEach((issue) => addIssue(issues, issue));

  mapSchemaIssues(validateSectionRows(sectionsJson ?? [], manifest), {
    codePrefix: "schema.section_row_invalid",
    category: "schema",
    severity: "error",
    artifactKey: "sections",
  }).forEach((issue) => addIssue(issues, issue));

  mapSchemaIssues(validateScheduleRows(schedulesJson ?? []), {
    codePrefix: "schema.schedule_row_invalid",
    category: "schema",
    severity: "error",
    artifactKey: "schedules",
  }).forEach((issue) => addIssue(issues, issue));

  mapSchemaIssues(validateMetadataRecord(metadataJson ?? {}), {
    codePrefix: "schema.metadata_invalid",
    category: "schema",
    severity: "error",
    artifactKey: "metadata",
  }).forEach((issue) => addIssue(issues, issue));

  for (const loadedArtifact of artifactData.values()) {
    const actualHash = await sha256File(loadedArtifact.absolutePath);
    if (actualHash.toLowerCase() !== String(loadedArtifact.artifact.sha256).toLowerCase()) {
      addIssue(issues, {
        code: "release_integrity.hash_mismatch",
        category: "release_integrity",
        severity: "error",
        artifactKey: loadedArtifact.artifact.key,
        path: loadedArtifact.artifact.path,
        message: `Artifact hash mismatch for ${loadedArtifact.artifact.path}`,
      });
    }
  }

  const computedReleaseId = computeReleaseIdFromArtifacts(manifest.artifacts ?? []);
  if (computedReleaseId !== manifest.releaseId) {
    addIssue(issues, {
      code: "release_integrity.release_id_mismatch",
      category: "release_integrity",
      severity: "error",
      artifactKey: "manifest",
      path: "releaseId",
      message: `releaseId ${manifest.releaseId} does not match computed content hash ${computedReleaseId}`,
    });
  }

  const courses = Array.isArray(coursesJson) ? (coursesJson as CourseRow[]) : [];
  const sections = Array.isArray(sectionsJson) ? (sectionsJson as SectionRow[]) : [];
  const schedules = Array.isArray(schedulesJson) ? (schedulesJson as ScheduleRow[]) : [];

  if (!artifactData.has("courses_json") && artifactData.has("courses_pbf")) {
    addIssue(issues, {
      code: "schema.courses_pbf_deep_validation_skipped",
      category: "schema",
      severity: "warning",
      artifactKey: "courses_pbf",
      message:
        "courses_pbf is present without courses_json; deep course-level validation is limited",
    });
  }

  if (courses.length !== manifest.counts.courses) {
    addIssue(issues, {
      code: "release_integrity.course_count_mismatch",
      category: "release_integrity",
      severity: "error",
      artifactKey: "courses",
      path: "counts.courses",
      message: `Manifest courses count ${manifest.counts.courses} does not match parsed courses ${courses.length}`,
    });
  }
  if (sections.length !== manifest.counts.sections) {
    addIssue(issues, {
      code: "release_integrity.section_count_mismatch",
      category: "release_integrity",
      severity: "error",
      artifactKey: "sections",
      path: "counts.sections",
      message: `Manifest sections count ${manifest.counts.sections} does not match parsed sections ${sections.length}`,
    });
  }
  if (schedules.length !== manifest.counts.schedules) {
    addIssue(issues, {
      code: "release_integrity.schedule_count_mismatch",
      category: "release_integrity",
      severity: "error",
      artifactKey: "schedules",
      path: "counts.schedules",
      message: `Manifest schedules count ${manifest.counts.schedules} does not match parsed schedules ${schedules.length}`,
    });
  }

  const courseIds = new Set<string>();
  const duplicateCourseIds = new Set<string>();
  for (const course of courses) {
    if (!course.id) {
      continue;
    }
    if (courseIds.has(course.id)) {
      duplicateCourseIds.add(course.id);
    }
    courseIds.add(course.id);
  }
  if (duplicateCourseIds.size > 0) {
    addIssue(issues, {
      code: "identity.duplicate_course_id",
      category: "identity",
      severity: "error",
      artifactKey: "courses",
      message: "Duplicate course ids detected",
      sampleValues: Array.from(duplicateCourseIds).slice(0, 10),
    });
  }

  const sectionIds = new Set<string>();
  const classCodeToSection = new Map<string, SectionRow>();
  const duplicateSectionIds = new Set<string>();
  const duplicateClassCodes = new Set<string>();
  let orphanSections = 0;

  for (const section of sections) {
    if (section.id) {
      if (sectionIds.has(section.id)) {
        duplicateSectionIds.add(section.id);
      }
      sectionIds.add(section.id);
    }
    if (section.classCode) {
      if (classCodeToSection.has(section.classCode)) {
        duplicateClassCodes.add(section.classCode);
      }
      classCodeToSection.set(section.classCode, section);
    }
    if (courses.length > 0 && section.courseId && !courseIds.has(section.courseId)) {
      orphanSections += 1;
      addIssue(issues, {
        code: "referential.section_course_missing",
        category: "referential",
        severity: "error",
        artifactKey: "sections",
        entityId: section.id,
        message: `Section ${section.id} references unknown courseId ${section.courseId}`,
      });
    }
  }

  if (duplicateSectionIds.size > 0) {
    addIssue(issues, {
      code: "identity.duplicate_section_id",
      category: "identity",
      severity: "error",
      artifactKey: "sections",
      message: "Duplicate section ids detected",
      sampleValues: Array.from(duplicateSectionIds).slice(0, 10),
    });
  }

  if (duplicateClassCodes.size > 0) {
    addIssue(issues, {
      code: "identity.duplicate_class_code",
      category: "identity",
      severity: "error",
      artifactKey: "sections",
      message: "Duplicate class codes detected",
      sampleValues: Array.from(duplicateClassCodes).slice(0, 10),
    });
  }

  const sectionIdToSection = new Map<string, SectionRow>(
    sections
      .filter((section) => typeof section.id === "string")
      .map((section) => [section.id, section]),
  );
  for (const section of sections) {
    if (section.parentSectionId && !sectionIdToSection.has(section.parentSectionId)) {
      addIssue(issues, {
        code: "referential.parent_section_missing",
        category: "referential",
        severity: "error",
        artifactKey: "sections",
        entityId: section.id,
        message: `Section ${section.id} references missing parentSectionId ${section.parentSectionId}`,
      });
    }
    if (
      typeof section.slotsAvailable === "number" &&
      typeof section.slotsTotal === "number" &&
      section.slotsAvailable > section.slotsTotal
    ) {
      addIssue(issues, {
        code: "semantic.slots_available_exceeds_total",
        category: "semantic",
        severity: "warning",
        artifactKey: "sections",
        entityId: section.id,
        message: `Section ${section.id} has slotsAvailable greater than slotsTotal`,
      });
    }
  }

  let orphanSchedules = 0;
  for (const schedule of schedules) {
    const bySectionId =
      schedule.sectionId && sectionIdToSection.has(schedule.sectionId)
        ? (sectionIdToSection.get(schedule.sectionId) ?? null)
        : null;
    const byClassCode =
      schedule.classCode && classCodeToSection.has(schedule.classCode)
        ? (classCodeToSection.get(schedule.classCode) ?? null)
        : null;
    const resolvedSection = bySectionId ?? byClassCode;

    if (!resolvedSection) {
      orphanSchedules += 1;
      addIssue(issues, {
        code: "referential.schedule_section_missing",
        category: "referential",
        severity: "error",
        artifactKey: "schedules",
        entityId: schedule.id,
        message: `Schedule ${schedule.id ?? "(unknown)"} does not resolve to a section`,
      });
    }

    if (bySectionId && byClassCode && bySectionId.id !== byClassCode.id) {
      addIssue(issues, {
        code: "referential.schedule_section_class_code_mismatch",
        category: "referential",
        severity: "error",
        artifactKey: "schedules",
        entityId: schedule.id,
        message: `Schedule ${schedule.id} references conflicting sectionId and classCode`,
      });
    }

    const startMinutes = toMinutes(schedule.timeStart);
    const endMinutes = toMinutes(schedule.timeEnd);
    if (startMinutes == null || endMinutes == null || endMinutes <= startMinutes) {
      addIssue(issues, {
        code: "semantic.invalid_schedule_time_range",
        category: "semantic",
        severity: "error",
        artifactKey: "schedules",
        entityId: schedule.id,
        message: `Schedule ${schedule.id ?? "(unknown)"} has an invalid time range`,
      });
    }
  }

  let regression: VerifierRegression | undefined;
  if (options.previousBundleDir) {
    const regressionIssues: VerifierIssue[] = [];
    const previousBundle = await loadBundle(options.previousBundleDir, regressionIssues, {
      allowPartialManifest: true,
    });
    if (previousBundle?.manifest?.counts) {
      const previousCounts = previousBundle.manifest.counts;
      const courseDeltaPct = percentDelta(courses.length, previousCounts.courses);
      const sectionDeltaPct = percentDelta(sections.length, previousCounts.sections);
      const scheduleDeltaPct = percentDelta(schedules.length, previousCounts.schedules);

      regression = {
        previousReleaseId: previousBundle.manifest.releaseId,
        ...(courseDeltaPct != null ? { courseDeltaPct } : {}),
        ...(sectionDeltaPct != null ? { sectionDeltaPct } : {}),
        ...(scheduleDeltaPct != null ? { scheduleDeltaPct } : {}),
      };

      if (courseDeltaPct != null && Math.abs(courseDeltaPct) > thresholds.courseDeltaPct) {
        addIssue(issues, {
          code: "regression.course_count_delta_threshold",
          category: "regression",
          severity: "warning",
          artifactKey: "manifest",
          message: `Course count delta ${courseDeltaPct.toFixed(1)}% exceeds threshold ${thresholds.courseDeltaPct}%`,
        });
      }
      if (sectionDeltaPct != null && Math.abs(sectionDeltaPct) > thresholds.sectionDeltaPct) {
        addIssue(issues, {
          code: "regression.section_count_delta_threshold",
          category: "regression",
          severity: "warning",
          artifactKey: "manifest",
          message: `Section count delta ${sectionDeltaPct.toFixed(1)}% exceeds threshold ${thresholds.sectionDeltaPct}%`,
        });
      }
      if (scheduleDeltaPct != null && Math.abs(scheduleDeltaPct) > thresholds.scheduleDeltaPct) {
        addIssue(issues, {
          code: "regression.schedule_count_delta_threshold",
          category: "regression",
          severity: "warning",
          artifactKey: "manifest",
          message: `Schedule count delta ${scheduleDeltaPct.toFixed(1)}% exceeds threshold ${thresholds.scheduleDeltaPct}%`,
        });
      }

      const currentUnits = new Set(
        courses
          .map((course) => course.offeringUnit)
          .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
      );
      const previousCourses = Array.isArray(previousBundle.artifactData.get("courses_json")?.json)
        ? (previousBundle.artifactData.get("courses_json")?.json as CourseRow[])
        : [];
      const previousUnits = new Set(
        previousCourses
          .map((course) => course.offeringUnit)
          .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
      );
      const suspiciousDepartments = Array.from(previousUnits).filter(
        (unit) => !currentUnits.has(unit),
      );
      if (suspiciousDepartments.length > 0) {
        regression = {
          ...regression,
          suspiciousDepartments,
        };
        addIssue(issues, {
          code: "regression.offering_unit_disappeared",
          category: "regression",
          severity: "warning",
          artifactKey: "courses",
          message: "One or more offering units disappeared from the release",
          sampleValues: suspiciousDepartments.slice(0, 10),
        });
      }
    }
  }

  const metadata = (metadataJson ?? null) as MetadataRecord | null;
  if (metadata?.connectorVersion && metadata.connectorVersion !== manifest.connectorVersion) {
    addIssue(issues, {
      code: "release_integrity.connector_version_mismatch",
      category: "release_integrity",
      severity: "warning",
      artifactKey: "metadata",
      message: `metadata.connectorVersion ${metadata.connectorVersion} does not match manifest.connectorVersion ${manifest.connectorVersion}`,
    });
  }

  const summary = summarizeIssues(issues);

  return {
    universityId: manifest.universityId,
    semesterId: manifest.semesterId,
    releaseId: manifest.releaseId,
    schemaVersion: manifest.schemaVersion,
    verifierVersion: VERIFIER_VERSION,
    generatedAt: new Date().toISOString(),
    summary,
    issues,
    metrics: {
      courses: courses.length,
      sections: sections.length,
      schedules: schedules.length,
      ...(manifest.counts.programs != null ? { programs: manifest.counts.programs } : {}),
      ...(manifest.counts.rooms != null ? { rooms: manifest.counts.rooms } : {}),
      duplicateClassCodes: duplicateClassCodes.size,
      orphanSections,
      orphanSchedules,
    },
    ...(regression ? { regression } : {}),
  };
}
