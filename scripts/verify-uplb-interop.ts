/**
 * Run UPLB catalog + curriculum verifiers from repo root (interop entrypoint).
 *
 *   npx tsx interop-repo/scripts/verify-uplb-interop.ts
 *   UPLB_BUNDLE_DIR=/path/to/bundle npx tsx interop-repo/scripts/verify-uplb-interop.ts
 * Default bundle: interop-repo/fixtures/uplb/bundle (moved from apps/scraper/output/uplb-bundle).
 */
import { spawnSync } from "child_process";
import { existsSync, realpathSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function repoRoot(): string {
  return resolve(__dirname, "..", "..");
}

function main() {
  const root = repoRoot();
  const envDir = process.env.UPLB_BUNDLE_DIR?.trim();
  const defaultDir = join(root, "interop-repo", "fixtures", "uplb", "bundle");
  const bundleDir = envDir ? resolve(envDir) : defaultDir;

  if (!existsSync(join(bundleDir, "courses.json"))) {
    console.error(
      `[verify-uplb-interop] No courses.json in ${bundleDir}\n` +
        `Set UPLB_BUNDLE_DIR or place a bundle at interop-repo/fixtures/uplb/bundle (see uplb:amis-to-bundle --out).`,
    );
    process.exit(1);
  }

  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const tsx = "tsx@4.21.0";

  const steps: Array<{ name: string; args: string[]; cwd: string }> = [
    {
      name: "catalog bundle (verify-uplb-bundle)",
      cwd: join(root, "apps", "scraper"),
      args: [tsx, "scripts/verify-uplb-bundle.ts", bundleDir],
    },
    {
      name: "curriculum CurriculumBundle (verify-uplb-curriculum-compat)",
      cwd: join(root, "apps", "web"),
      args: [tsx, "scripts/verify-uplb-curriculum-compat.ts", bundleDir],
    },
  ];

  for (const s of steps) {
    console.log(`\n[verify-uplb-interop] → ${s.name}`);
    let cwdLabel = s.cwd;
    try {
      cwdLabel = realpathSync(s.cwd);
    } catch {
      // symlink / permission edge: still log configured path
    }
    console.log(`  dir: ${cwdLabel}`);
    const r = spawnSync(npx, s.args, {
      cwd: s.cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    if (r.status !== 0) {
      console.error(`[verify-uplb-interop] FAILED at: ${s.name}`);
      process.exit(r.status ?? 1);
    }
  }

  console.log(`\n[verify-uplb-interop] OK — bundle: ${bundleDir}`);
}

main();
