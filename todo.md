# Tracker update checklist

- [x] Inspect the current bulletin and historical data structures.
- [x] Verify the newest Visa Bulletin directly against the official Department of State publication.
- [x] Move the prior current bulletin into the historical archive and enter the verified new cutoffs.
- [x] Validate the updated display, historical chart, and projection calculations for anomalies.
- [x] Save a checkpoint with a concise data-update summary.

## Reusable skill package

- [x] Define the repeatable monthly Visa Bulletin update workflow.
- [x] Create the `visa-bulletin-tracker-update` skill package.
- [x] Validate and deliver the packaged skill.

## Missing-feature release

- [x] Audit the existing interface, data model, and tests for already-implemented features.
- [x] Select static-compatible features that add new user value without duplication.
- [x] Implement the selected features and their tests.
- [x] Validate the updated site on desktop and mobile, then save a checkpoint.

## Monthly briefing

- [x] Review current and prior bulletin movement data for selected categories.
- [x] Add a concise, status-aware “What changed this month?” briefing section.
- [x] Test the briefing across standard and unavailable-cutoff states.
- [x] Validate desktop/mobile presentation and save a checkpoint.

## October 2026 bulletin update

- [x] Verify October 2026 Visa Bulletin values from the official U.S. Department of State source.
- [x] Inspect current tracker data, briefing, projections, and tests before editing.
- [x] Archive September 2026 and set October 2026 as the current bulletin without overwriting upstream changes.
- [x] Refresh category notes, briefing context, forecast assumptions, and validation tests using verified data.
- [x] Run typecheck, unit tests, build, and production preview checks.
- [x] Save a project checkpoint and confirm the deployed tracker reflects October 2026.

## USCIS demand refresh — October 1, 2026

- [x] Fast-forward local main through upstream `79f782b`.
- [x] Verify the newer August 5, 2026 India-specific I-485 inventory and retain source workbooks and extraction provenance.
- [x] Update the queue chart with separate disclosed inventory and estimated additional demand, including partial filing-year handling.
- [x] Correct I-140 category mapping: include NIW in EB-2; exclude EW3 from skilled/professional EB-3.
- [x] Add a visible Q3 receipt-flow indicator and FY2026 Q1–Q3 India receipt trends.
- [x] Document fixed-date before/after forecasts and source limitations in `docs/forecast-data-update-2026-10-01.md`.
- [x] Pass TypeScript, 87 unit tests, production build, and desktop/mobile visual checks.
- [x] Remove the scheduled monitor at the user's request; future USCIS checks are on demand.
- [ ] Deploy these local changes when requested.
