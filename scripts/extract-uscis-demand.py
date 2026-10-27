"""Extract the checked-in USCIS workbooks without inventing suppressed counts.

Run with Python + openpyxl from the repository root. Sources and cell ranges
are retained in the generated JSON for review and future release comparisons.
"""
import hashlib
import json
from pathlib import Path

import openpyxl

DATA = Path(__file__).resolve().parents[1] / "data"
inventory_file = "eb_inventory_august_2026_v1.0.xlsx"
workbook = openpyxl.load_workbook(DATA / inventory_file, data_only=True)
inventory = {
    "asOf": "August 5, 2026",
    "published": "August 25, 2026",
    "verified": "October 1, 2026",
    "sourceUrl": f"https://www.uscis.gov/sites/default/files/document/data/{inventory_file}",
    "workbook": inventory_file,
    "sha256": hashlib.sha256((DATA / inventory_file).read_bytes()).hexdigest(),
    "method": "Sum monthly Available and Awaiting Availability rows for each preference. D is undisclosed, never zero. Disclosed counts are lower bounds where D occurs. Prior Years is kept separate from individual years. EW3 is excluded from EB3.",
    "categories": {},
}
for category, sheet_name in [
    ("EB1", "India (EB1 EW3 EB4 CRW EB5)"),
    ("EB2", "India (EB2 EB3)"),
    ("EB3", "India (EB2 EB3)"),
]:
    sheet = workbook[sheet_name]
    rows = [(i, row) for i, row in enumerate(sheet.values, 1)
            if row[0] == "India" and row[1].endswith(f"({category})")]
    years = {}
    for col in range(4, 15):
        label = sheet.cell(4, col + 1).value.removeprefix("Priority Date Year - ")
        values = [row[col] for _, row in rows]
        assert all(isinstance(v, (int, float)) or v == "D" for v in values)
        years[label] = {
            "disclosed": sum(v for v in values if isinstance(v, (int, float))),
            "suppressedCells": values.count("D"),
        }
    inventory["categories"][category] = {
        "sheet": sheet_name,
        "range": f"E{rows[0][0]}:O{rows[-1][0]}",
        "years": years,
        "disclosedTotal": sum(v["disclosed"] for v in years.values()),
        "suppressedCells": sum(v["suppressedCells"] for v in years.values()),
        "partialPriorityDateYears": [2023] if category == "EB1" else [2015],
    }
(DATA / "i485_india_august_2026.json").write_text(json.dumps(inventory, indent=2) + "\n")

receipts = []
for quarter, file_name, source_dir in [
    (1, "i140_fy2026_q1_v1.xlsx", "reports"),
    (2, "i140_fy2026_q2_v1.xlsx", "data"),
    (3, "i140_performance_fy2026_q3_v1.xlsx", "data"),
]:
    sheet = openpyxl.load_workbook(DATA / file_name, data_only=True)["Rec-COB"]
    assert sheet.cell(3, 1).value == f"Fiscal Year 2026 (Q{quarter})"
    row_number, row = next((i, row) for i, row in enumerate(sheet.values, 1) if row[0] == "INDIA")
    source_name = f"i140_fy2026_q{quarter}_v1.xlsx"
    eb1, eb2, eb3, ew3 = sum(row[1:4]), sum(row[4:6]), sum(row[6:8]), row[8]
    assert eb1 + eb2 + eb3 + ew3 == row[9]
    receipts.append({
        "period": f"FY2026 Q{quarter}",
        "eb1": eb1, "eb2": eb2, "eb3": eb3, "ew3": ew3, "total": row[9],
        "sourceUrl": f"https://www.uscis.gov/sites/default/files/document/{source_dir}/{source_name}",
        "workbook": file_name, "sheet": "Rec-COB", "range": f"A{row_number}:J{row_number}",
        "sha256": hashlib.sha256((DATA / file_name).read_bytes()).hexdigest(),
    })
(DATA / "i140_india_quarterly_receipts.json").write_text(json.dumps(receipts, indent=2) + "\n")

# Match the tracker categories: all EB2 approvals include NIW; the EB3
# skilled/professional series excludes the separately capped EW3 category.
approval_file = "i140_rec_by_class_country_fy2026_q3_v1.xlsx"
sheet = openpyxl.load_workbook(DATA / approval_file, data_only=True)["India FY26"]
approvals = {
    "source": "USCIS",
    "report": "Form I-140, Receipts and Current Status by Preference and Country",
    "period": "FY2014-FY2026 Q3 (queried July 2026)",
    "workbook": approval_file,
    "sourceUrl": f"https://www.uscis.gov/sites/default/files/document/data/{approval_file}",
    "sheet": "India FY26",
    "scope": "Approved petitions grouped by fiscal year received, not priority date. EB2 includes NIW. EB3 includes E31 and E32 only; EW3 is excluded.",
    "ranges": {"EB1": "B11:N11", "EB2": "B20:N20", "EB3": "B32:N33"},
}
for category, source_rows in [("eb1", [11]), ("eb2", [20]), ("eb3", [32, 33])]:
    approvals[f"{category}_approval_series"] = {
        str(sheet.cell(4, col).value): sum(sheet.cell(row, col).value for row in source_rows)
        for col in range(2, 15)
    }
(DATA / "i140_india_fy2026_q3.json").write_text(json.dumps(approvals, indent=2) + "\n")
print("Inventory:", {k: v["disclosedTotal"] for k, v in inventory["categories"].items()})
print("Receipts:", [{k: v for k, v in r.items() if k in ("period", "eb1", "eb2", "eb3", "ew3", "total")} for r in receipts])
