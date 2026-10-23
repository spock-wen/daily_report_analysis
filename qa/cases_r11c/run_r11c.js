'use strict';
const fs = require('fs');
const path = require('path');
const rule = require('../../src/checker/rules/r11c');
const { loadDocument } = require('../../src/checker/document');

const cases = [
  { id: 'R11C-W-P01', level: 'weekly', file: 'weekly_pass.html', expect: 'PASS' },
  { id: 'R11C-W-F01', level: 'weekly', file: 'weekly_fail.html', expect: 'FAIL' },
  { id: 'R11C-M-P01', level: 'monthly', file: 'monthly_pass.html', expect: 'PASS' },
  { id: 'R11C-M-F01', level: 'monthly', file: 'monthly_fail.html', expect: 'FAIL' },
  { id: 'R11C-M-F02', level: 'monthly', file: 'monthly_zerobars_fail.html', expect: 'FAIL' },
];

let failed = 0;
for (const c of cases) {
  const filePath = path.join(__dirname, 'fixtures', c.file);
  const doc = loadDocument(filePath, 'html');
  const findings = rule.check({ level: c.level }, doc);
  const pass = findings.length === 0;
  const ok = (c.expect === 'PASS' && pass) || (c.expect === 'FAIL' && !pass);
  console.log(`${ok ? 'OK' : 'BAD'} ${c.id} expect=${c.expect} findings=${findings.length}`);
  if (!ok) {
    failed += 1;
    for (const f of findings) console.log('  -', f.message);
  }
}
process.exit(failed ? 1 : 0);
