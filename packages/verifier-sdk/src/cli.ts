import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { VerifierReport } from "./verifier.js";
import { verifyReleaseBundle } from "./verifier.js";

interface CliArgs {
  bundleDir: string | null;
  previousBundleDir: string | null;
  outFile: string | null;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { bundleDir: null, previousBundleDir: null, outFile: null };
  const rest = argv.slice(2);

  if (rest.length === 0) {
    return args;
  }

  args.bundleDir = rest[0] ?? null;
  for (let index = 1; index < rest.length; index += 1) {
    const current = rest[index];
    if (current === "--previous") {
      args.previousBundleDir = rest[index + 1] ?? null;
      index += 1;
    } else if (current === "--out") {
      args.outFile = rest[index + 1] ?? null;
      index += 1;
    }
  }

  return args;
}

function printReport(report: VerifierReport): void {
  console.log(`Verifier version: ${report.verifierVersion}`);
  console.log(`Release: ${report.universityId}/${report.semesterId}/${report.releaseId}`);
  console.log(
    `Summary: ${report.summary.errorCount} errors, ${report.summary.warningCount} warnings, ${report.summary.infoCount} info`,
  );
  console.log(
    `Metrics: ${report.metrics.courses} courses, ${report.metrics.sections} sections, ${report.metrics.schedules} schedules`,
  );

  if (report.issues.length > 0) {
    console.log("\nIssues:");
    for (const issue of report.issues) {
      const scope = issue.path ? ` (${issue.path})` : "";
      console.log(`- [${issue.severity}] ${issue.code}${scope}: ${issue.message}`);
    }
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  if (!args.bundleDir) {
    console.error(
      "Usage: tsx packages/verifier-sdk/src/cli.ts <bundle-dir> [--previous <dir>] [--out <file>]",
    );
    process.exit(1);
  }

  const report = await verifyReleaseBundle(resolve(args.bundleDir), {
    ...(args.previousBundleDir ? { previousBundleDir: resolve(args.previousBundleDir) } : {}),
  });

  printReport(report);

  if (args.outFile) {
    await writeFile(resolve(args.outFile), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }

  process.exit(report.summary.blocking ? 1 : 0);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
