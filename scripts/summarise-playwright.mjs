// Reads the Playwright JSON report and writes the coverage summary for the CI log
// and job summary. Genuine passes are counted separately from expected failures
// (known defects asserted against their desired state), so a green board never
// hides a defect. An unexpected pass on a defect check is listed as a failure.
import { readFileSync, existsSync } from 'node:fs';

const path = 'test-results/report.json';
if (!existsSync(path)) {
  console.log('## Coverage summary\n\nNo Playwright report found - the browser step did not run.');
  process.exit(0);
}
const report = JSON.parse(readFileSync(path, 'utf8'));

const genuine = [], expectedFailures = [], unexpected = [], flaky = [], skipped = [];
function walk(suites) {
  for (const suite of suites || []) {
    for (const spec of suite.specs || []) {
      for (const t of spec.tests || []) {
        const label = `[${t.projectName}] ${spec.title}`;
        const defect = (t.annotations || []).find((a) => a.type === 'known-defect');
        if (t.status === 'skipped') { skipped.push(label); continue; }
        if (t.expectedStatus === 'failed') {
          if (t.status === 'expected') {
            expectedFailures.push(`${label} - ${defect ? defect.description : 'no reason recorded'}`);
          } else {
            unexpected.push(`${label} (UNEXPECTED PASS - the known defect no longer reproduces; update the defect record)`);
          }
        } else if (t.status === 'expected') genuine.push(label);
        else if (t.status === 'flaky') flaky.push(label);
        else unexpected.push(label);
      }
    }
    walk(suite.suites);
  }
}
walk(report.suites);

const lines = [];
lines.push('## Coverage summary', '');
lines.push(`- Genuine passing browser checks: ${genuine.length}`);
lines.push(`- Known defects present (expected failures, asserted against the desired state): ${expectedFailures.length}`);
lines.push(`- Unexpected failures: ${unexpected.length}`);
if (flaky.length) lines.push(`- Flaky (passed on retry): ${flaky.length}`);
if (skipped.length) lines.push(`- Skipped: ${skipped.length}`);
lines.push('');
if (expectedFailures.length) {
  lines.push('### Known defects (expected failures)', '');
  for (const d of expectedFailures) lines.push(`- ${d}`);
  lines.push('');
}
if (unexpected.length) {
  lines.push('### Unexpected failures', '');
  for (const u of unexpected) lines.push(`- ${u}`);
  lines.push('');
}
if (flaky.length) {
  lines.push('### Flaky', '');
  for (const f of flaky) lines.push(`- ${f}`);
  lines.push('');
}
console.log(lines.join('\n'));
process.exit(unexpected.length ? 1 : 0);
