#!/usr/bin/env node
/**
 * Extract classes from a captured HAR (browser Network export) and map to raw section rows.
 *
 * Usage:
 *   node pipeline/transform-from-har.cjs [path/to/capture.har]
 */
const fs = require('fs');
const path = require('path');
const { transformAmisClasses } = require('./lib/uplb-amis-transform.cjs');

const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const harPath = path.resolve(process.argv[2] || path.join(REPO_ROOT, '..', 'docs', 'amis.uplb.edu.ph (1).har'));

if (!fs.existsSync(harPath)) {
  console.error(`HAR not found: ${harPath}`);
  console.error('Pass path as first argument or place docs/amis.uplb.edu.ph (1).har next to the monorepo.');
  process.exit(1);
}

const harData = JSON.parse(fs.readFileSync(harPath, 'utf8'));
const classesRequest = harData.log.entries.find((e) => e.request.url.includes('/api/students/classes'));
if (!classesRequest) {
  console.error('Could not find classes request in HAR.');
  process.exit(1);
}

const rawResponse = JSON.parse(classesRequest.response.content.text);
const classesData = rawResponse.classes?.data || [];

console.log(`Found ${classesData.length} classes in HAR to transform.`);

const transformed = transformAmisClasses(classesData);

const outDir = path.join(REPO_ROOT, 'fixtures', 'uplb');
fs.mkdirSync(outDir, { recursive: true });
const outputPath = path.join(outDir, 'uplb-sections-raw.json');
fs.writeFileSync(outputPath, JSON.stringify(transformed, null, 2));

console.log(`Wrote ${transformed.length} rows → ${outputPath}`);
