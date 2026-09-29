/**
 * Design: verify that the monthly briefing translates special bulletin states
 * into plain language without exposing a retained forecast anchor as live data.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BulletinBriefing, buildBulletinBriefing } from "./BulletinBriefing";
import type { HistoricalBulletinRow } from "@/data/trackerData";

const rows: HistoricalBulletinRow[] = [
  {
    month: "October 2026",
    eb1_fad: "2023-02-01",
    eb1_dof: "2024-07-01",
    eb2_fad: "2013-11-01",
    eb2_dof: "2015-01-15",
    eb3_fad: "2014-01-01",
    eb3_dof: "2015-01-15",
  },
  {
    month: "September 2026",
    eb1_fad: "2022-10-15",
    eb1_dof: "2023-12-01",
    eb2_fad: "2014-07-15",
    eb2_fad_status: "unavailable",
    eb2_dof: "2015-01-15",
    eb3_fad: "2014-01-01",
    eb3_dof: "2015-01-15",
  },
  {
    month: "August 2026",
    eb1_fad: "2022-10-15",
    eb1_dof: "2023-12-01",
    eb2_fad: "2014-07-15",
    eb2_fad_status: "unavailable",
    eb2_dof: "2015-01-15",
    eb3_fad: "2014-01-01",
    eb3_dof: "2015-01-15",
  },
];

describe("BulletinBriefing", () => {
  it("summarizes the return to availability and a stable filing cutoff plainly", () => {
    const briefing = buildBulletinBriefing("EB2", rows);

    expect(briefing?.items[0].value).toBe("Available again: Nov 1, 2013");
    expect(briefing?.items[1].value).toBe("Held at Jan 15, 2015");
  });

  it("renders a source-linked briefing for the selected category", () => {
    render(
      <BulletinBriefing
        category="EB2"
        categoryLabel="EB-2"
        rows={rows}
        bulletinUrl="https://example.com/bulletin"
      />
    );

    expect(
      screen.getByRole("heading", { name: /what changed this month/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Available again: Nov 1, 2013")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /read the official october 2026 bulletin/i })
    ).toHaveAttribute("href", "https://example.com/bulletin");
  });
});
