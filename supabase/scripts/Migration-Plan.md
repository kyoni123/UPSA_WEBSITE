# Historical ranking migration plan

## Inputs

- Source: `rankings-data.js`
- Public JavaScript variable: `window.upsaRankings`
- Available years: 2022, 2023, 2024, 2025, 2026
- Source ranking rows: 2,144
- Source categories: 30

## Target data

For each source season:

1. Insert or find one `seasons` record by unique year.
2. Insert or find one `divisions` record by season and normalized division key.
3. Preserve source category title and category index.
4. Insert one `ranking_source_records` row per original ranking row.
5. Store original headers and original row values as JSONB.
6. Hash each source row and use the hash for repeat-safe identification.
7. Insert one `ranking_entries` row for the source record.
8. Insert normalized rank, total points, carryover, and leg points when available.
9. Preserve empty values as `null`, not as numeric zero.
10. Preserve source strings in source fields for traceability.

## Repeat-safe import

- The source hash is calculated from season, category title/index, row index, headers, and original row.
- `ranking_source_records.source_hash` is unique.
- Import in staging is upserted or rejected only on the source hash.
- Running the import twice must not create duplicate source rows or ranking entries.
- Existing rows must be compared before updates; unexpected source changes require review.
- The script must run in dry-run mode first and print counts and differences.

## Athlete resolution

Do not insert identity links while importing if identity status is uncertain.

### Source ID case

- Create a source identity mapping only for an unambiguous Athlete ID.
- An ID is unambiguous only when it maps to one normalized name within the same source year/category rules.
- Preserve the source ID on the ranking entry even when no permanent athlete row can be safely selected.

### Exact-name case

- Exact normalized name matches may be marked `exact-name`.
- Exact-name matches used only in 2022-2024 or missing-ID seasons remain `exact-name-provisional`.

### Conflict cases

Known 2025 conflicts:

- Athlete ID `25105`: `Maureen Delamide`, `Ashlee Lopez`
- Athlete ID `25400`: `Astrid Sadaya`, `Maureen Delamide`

These IDs must remain unresolved or be separated from the source rows until reviewed. Never merge the identities by name alone.

### Duplicate-name cases

Duplicate name rows in the same source category/season must remain separate source records. Create duplicate-name review records rather than merging rows.

### 2022-2024

There are no Athlete ID columns. Automatic linking must use only exact source-name evidence and must remain provisional. Cross-year promotion to an official athlete requires independent verification.

## Handling missing values

- Missing leg values remain `null`.
- Published string `"-"` should be preserved in `source_value` and imported as `null` in `points`.
- Numeric zero remains numeric zero.
- A source row must retain every original header and value in JSONB.
- Carryover points are not individual competition results.

## Validation procedure

Compare:

1. Season count: 5
2. Division count: 30
3. Source ranking row count: 2,144
4. 2022 source row count: 556
5. 2023 source row count: 373
6. 2024 source row count: 363
7. 2025 source row count: 497
8. 2026 source row count: 355
9. All source hashes equal the source hash set
10. Each source row equals its JSONB headers and row values
11. Rank, total points, and carryover values match source values
12. Leg labels and leg values match original headers and row indexes
13. Each source record has exactly one ranking entry
14. No conflicting or duplicate source identity is automatically merged
15. No competition result is created from leg-point data

## Conflict and exception report

Generate an import report containing:

- Unmatched names
- Conflicting Athlete IDs
- Duplicate source names
- Missing or malformed values
- Row-width mismatches
- Source hash collisions
- Unexpected new or removed source rows

No exception should be silently dropped. Database import should stop or mark rows pending review according to a pre-approved rule.
