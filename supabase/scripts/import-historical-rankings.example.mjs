// Review/draft only. This script does not send data or credentials to Supabase.
// Future approved implementation may add an approved Supabase REST/SDK client.

import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

const sourcePath = new URL('../../rankings-data.js', import.meta.url);
const source = fs.readFileSync(sourcePath, 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(source, sandbox, { filename: 'rankings-data.js' });

const rankingYears = sandbox.window.upsaRankings;
if (!Array.isArray(rankingYears)) {
  throw new Error('UPSA rankings data was not loaded.');
}

const normalizeName = name =>
  String(name).trim().replace(/\s+/g, ' ').normalize('NFC').toLocaleLowerCase();

const importPlan = [];

for (const season of rankingYears) {
  for (let categoryIndex = 0; categoryIndex < season.categories.length; categoryIndex += 1) {
    const category = season.categories[categoryIndex];
    const headers = category.headers.map(header => String(header));
    for (let rowIndex = 0; rowIndex < category.rows.length; rowIndex += 1) {
      const row = category.rows[rowIndex].map(value => value === null ? null : String(value));
      if (row.length !== headers.length) {
        throw new Error(
          `Row width mismatch: ${season.year} ${category.title} row ${rowIndex + 1}`
        );
      }

      const sourceObject = {
        seasonYear: season.year,
        seasonTitle: season.title,
        categoryTitle: category.title,
        categoryIndex,
        rowIndex,
        headers,
        row
      };
      const sourceHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(sourceObject))
        .digest('hex');

      const nameIndex = headers.findIndex(header => /^name$/i.test(header));
      const idIndex = headers.findIndex(header => /^athlete\s*id$/i.test(header));
      const rankIndex = headers.findIndex(header => /^rank$/i.test(header));
      const totalPointsIndex = headers.findIndex(header => /^total points/i.test(header));
      const sourceName = nameIndex >= 0 ? row[nameIndex] : null;
      const sourceAthleteId = idIndex >= 0 && row[idIndex] !== '' ? row[idIndex] : null;

      importPlan.push({
        sourceHash,
        seasonYear: season.year,
        seasonTitle: season.title,
        categoryTitle: category.title,
        categoryIndex,
        rowIndex,
        sourceName,
        normalizedSourceName: sourceName ? normalizeName(sourceName) : null,
        sourceAthleteId,
        rankLabel: rankIndex >= 0 ? row[rankIndex] : null,
        totalPointsLabel: totalPointsIndex >= 0 ? headers[totalPointsIndex] : null,
        totalPointsValue: totalPointsIndex >= 0 ? row[totalPointsIndex] : null,
        sourceHeaders: headers,
        sourceRow: row
      });
    }
  }
}

const hashes = new Set(importPlan.map(record => record.sourceHash));
console.log(JSON.stringify({
  mode: 'DRY-RUN-DRAFT-ONLY',
  sourceRows: importPlan.length,
  uniqueSourceHashes: hashes.size,
  seasons: [...new Set(importPlan.map(record => record.seasonYear))]
}, null, 2));
