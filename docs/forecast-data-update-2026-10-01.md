# October 1, 2026 demand data update

USCIS has published an India-specific I-485 inventory **as of August 5, 2026**, posted August 25. It supersedes the October 2025 input retained by commit `79f782b`. The official data library also lists monthly snapshots for June and July, both posted August 25. Inventory snapshots are monthly in this series but may be published in batches. I-140 receipt/performance and I-485 quarterly performance reports are quarterly. Future checks are on demand; no scheduled monitor is active.

Sources: [USCIS inventory library](https://www.uscis.gov/tools/reports-and-studies/immigration-and-citizenship-data?query=inventory), [August inventory workbook](https://www.uscis.gov/sites/default/files/document/data/eb_inventory_august_2026_v1.0.xlsx), [I-140 approval cohorts](https://www.uscis.gov/sites/default/files/document/data/i140_rec_by_class_country_fy2026_q3_v1.xlsx).

## Queue changes

| India category / priority-date year | Previous stored count | August 2026 disclosed count |
| --- | ---: | ---: |
| EB-1 / 2022 | 10,953 | 3,905 |
| EB-1 / 2023 | No filed inventory in model | 11,805 |
| EB-2 / 2013 | 10,287 | 5,532 |
| EB-2 / 2014 | 17,092 | 20,813 |
| EB-2 / 2015 | No filed inventory in model | 999 |
| EB-3 / 2014 | 10,346 | 13,240 |
| EB-3 / 2015 | No filed inventory in model | 155 |

The new disclosed totals, including the separate Prior Years column, are EB-1 **19,261**, EB-2 **27,736**, and EB-3 **15,843**. EB-2 and EB-3 have suppressed cells, so those sums are lower bounds. The old stored series did not cover exactly the same years, so subtracting the totals would not measure net case clearance.

The queue chart stacks disclosed inventory and estimated additional demand. The August filing coverage includes only part of EB-1 PD-2023 and EB-2/EB-3 PD-2015. Those years cannot be used to calibrate a full-year proxy; the model uses the larger of the observed count and scaled I-140 demand. Prior Years is not assigned to an invented year. Suppressed cells are retained as unknown in provenance.

Review of the I-140 source also corrected two category mappings: EB-2 now includes both advanced-degree and NIW approvals (the prior import used only the advanced-degree row), and EB-3 uses E31 + E32, excluding EW3. Approved petitions are grouped by **receipt fiscal year**, not approval year or priority-date year. FY2026 is partial through Q3.

## Estimate comparison

These are controlled data replays for **EB-2 India, priority date August 1, 2016**, calculated as of **October 1, 2026** with 500 paths, the same deterministic scenario seeds, and the same 240-month horizon. Dates are median estimates rounded to month, not promises of visa availability. Changing the calculation date or assumptions changes the displayed dates.

### Default Overview settings

The Overview hero shows the **optimistic** scenario, with **high spillover, ban through 2029, and low wastage**. It is not the base case.

| Data version | Filing date (DoF) | Final action (FAD) | Green-card receipt |
| --- | --- | --- | --- |
| Local checkout before sync (`2af6fb9`, August bulletin inputs) | Mar 2028 | Aug 2028 | Nov 2029 |
| October bulletin before Q3 data (`e549957`) | Sep 2028 | Mar 2029 | Jun 2030 |
| Latest pulled Q3 data (`79f782b`) | Sep 2028 | Apr 2029 | Oct 2030 |
| Updated inventory and corrected category mapping | **Sep 2028** | **Mar 2029** | **Sep 2030** |

Compared with the October bulletin before Q3 data, the headline filing/final-action month is unchanged and green-card receipt moves about three months later, chiefly because the modeled processing lag increased from 15 to 18 months. Compared with the latest pulled data, the corrected category mapping brings final action and receipt forward 17 days, crossing a month boundary. The updated hero's 80% interval is approximately September 2028–February 2030 for FAD and March 2030–August 2031 for receipt.

### Direct comparison with the user's scenario screenshot

All scenario cards use the selected assumption controls. The screenshot's base rate of 1.344 PD-months per month reflects **high spillover, ban through 2029, and low wastage**, applied to the underlying base rate of 0.85. Thus the base scenario in that screenshot differs from the moderate-assumptions comparison below.

| Scenario / milestone | Screenshot (`79f782b`) | Updated locally | Change |
| --- | --- | --- | --- |
| Base: filing (DoF) | Sep 24, 2030 | Sep 17, 2030 | 7 days earlier |
| Base: final action (FAD) | Sep 17, 2031 | Sep 6, 2031 | 11 days earlier |
| Base: green-card receipt | Mar 18, 2033 | Mar 6, 2033 | 12 days earlier |
| Optimistic: filing (DoF) | Sep 28, 2028 | Sep 23, 2028 | 5 days earlier |
| Optimistic: final action (FAD) | Apr 12, 2029 | Mar 26, 2029 | 17 days earlier |
| Optimistic: green-card receipt | Oct 12, 2030 | Sep 25, 2030 | 17 days earlier |

The **2030 base-case estimate is the filing milestone**, while its final-action and receipt milestones remain in 2031 and 2033. These small day-level changes are well within the model's broad uncertainty ranges; exact dates are shown here only to reconcile the screenshot.

### Base scenario with moderate assumptions

For an independent planning comparison, hold **moderate spillover, ban through 2028, and moderate wastage** throughout:

| Data version | Filing date (DoF) | Final action (FAD) | Green-card receipt |
| --- | --- | --- | --- |
| Local checkout before sync (`2af6fb9`) | Nov 2031 | May 2032 | Aug 2033 |
| October bulletin before Q3 data (`e549957`) | Nov 2032 | Mar 2034 | Jun 2035 |
| Latest pulled Q3 data (`79f782b`) | Feb 2033 | Sep 2034 | Mar 2036 |
| Updated inventory and corrected category mapping | **Jan 2033** | **Jun 2034** | **Dec 2035** |

The final base result is about three months later for final action and six months later for receipt than the October bulletin before Q3 data. It is about three months earlier than the latest pulled Q3 model. The 80% interval is approximately December 2032–October 2035 for FAD and July 2034–April 2037 for receipt. The broader shift from the original local checkout also includes the September/October bulletin history and the replacement of the unavailable-date recovery anchor with October's actual cutoff; it cannot be attributed entirely to USCIS demand data.

## Why the inventory alone does not move this estimate

With the pulled I-140 mapping unchanged, the inventory update alone produces the same EB-2 August 2016 forecast quantiles in this model. Both the future-year proxy and its median reference scale together; the earlier low-demand years remain at the same clamped slowdown floor. This model responds to **relative annual density**, not absolute queue size divided by visa supply.

The category-mapping correction changes those relative densities. For PD-2016, demand/reference changes from about 1.378 in the pulled model to 1.309 after the correction, explaining the modest earlier forecast despite adding omitted NIW petitions. This is a property of the current model, not evidence that more petitions shorten real waits.

The national pending/completions ratio remains an 18-month receipt-lag floor. It is an operational assumption, not a measured India-specific adjudication time.

## Quarterly receipts

| India category | FY2026 Q1 | FY2026 Q2 | FY2026 Q3 |
| --- | ---: | ---: | ---: |
| EB-1 | 3,684 | 3,625 | 3,699 |
| EB-2, including NIW | 9,018 | 9,043 | 12,231 |
| EB-3, excluding EW3 | 3,027 | 2,793 | 3,617 |
| EW3 other workers | 10 | 6 | 2 |
| Total | 15,739 | 15,467 | 19,549 |

EB-2 receipts increased **35.3% from Q2 to Q3**. This flow indicator has no priority-date distribution and does not directly alter forecast dates. The previously quoted EB-3 figure of 3,619 included two EW3 petitions; the new displays separate them.

Sources: [Q1 workbook](https://www.uscis.gov/sites/default/files/document/reports/i140_fy2026_q1_v1.xlsx), [Q2 workbook](https://www.uscis.gov/sites/default/files/document/data/i140_fy2026_q2_v1.xlsx), [Q3 workbook](https://www.uscis.gov/sites/default/files/document/data/i140_fy2026_q3_v1.xlsx). The extraction script retains source sheet/range references and file hashes in the inventory and receipt JSON files.

## On-demand refresh

Search the official USCIS data library for **inventory** and verify the newest workbook's as-of date and India tables. Check quarterly I-140 receipt and country-status workbooks separately. Download new releases, update the extraction configuration, and rerun `scripts/extract-uscis-demand.py` with Python and openpyxl. Review suppression, category definitions, filing coverage, and partial-year treatment before updating model inputs. Run typecheck, tests, production build, and desktop/mobile chart checks.
