import { describe, expect, it } from "vitest";

import {
  areConsecutiveBulletinMonths,
  bulletinMonthDiffInMonths,
  fmtBulletinMonthLabel,
  fmtCompactMonthYear,
  fmtDateStr,
  fmtDuration,
  isValidDateStr,
  monthsBetween,
  movementLabel,
  parseBulletinMonth,
  parseDateStr,
  sumRecordValues,
} from "./trackerUtils";

describe("trackerUtils", () => {
  it("parses and formats strict YYYY-MM-DD dates", () => {
    const date = parseDateStr("2016-08-01");

    expect(date.getFullYear()).toBe(2016);
    expect(date.getMonth()).toBe(7);
    expect(date.getDate()).toBe(1);
    expect(fmtDateStr("2016-08-01")).toBe("Aug 1, 2016");
    expect(fmtCompactMonthYear("2016-08-01")).toBe("Aug '16");
  });

  it("rejects malformed or overflowing date strings", () => {
    expect(isValidDateStr("2026-06-01")).toBe(true);
    expect(isValidDateStr("2026-6-1")).toBe(false);
    expect(isValidDateStr("2026-02-30")).toBe(false);
    expect(() => parseDateStr("2026-02-30")).toThrow(RangeError);
    expect(() => parseDateStr("not-a-date")).toThrow(RangeError);
  });

  it("parses short and full bulletin month labels", () => {
    expect(parseBulletinMonth("Jun 2026").getMonth()).toBe(5);
    expect(parseBulletinMonth("June 2026").getFullYear()).toBe(2026);
    expect(fmtBulletinMonthLabel("June 2026")).toBe("June '26");
    expect(() => parseBulletinMonth("Foo 2026")).toThrow(RangeError);
  });

  it("calculates bulletin month distance and consecutiveness", () => {
    expect(bulletinMonthDiffInMonths("Jun 2026", "May 2026")).toBe(1);
    expect(bulletinMonthDiffInMonths("Jan 2027", "Dec 2026")).toBe(1);
    expect(areConsecutiveBulletinMonths("Jun 2026", "May 2026")).toBe(true);
    expect(areConsecutiveBulletinMonths("Jun 2026", "Apr 2026")).toBe(false);
  });

  it("formats durations and date movements", () => {
    expect(fmtDuration(6)).toBe("6 mo");
    expect(fmtDuration(12)).toBe("1 yr");
    expect(fmtDuration(26)).toBe("2 yrs 2 mo");

    expect(movementLabel("2014-07-15", "2014-08-15")).toMatchObject({
      type: "advancement",
      label: "+1mo (+31d)",
    });
    expect(movementLabel("2014-08-15", "2014-07-15")).toMatchObject({
      type: "retrogression",
      label: "-1mo (-31d)",
    });
    expect(movementLabel("2014-07-15", "2014-07-18")).toMatchObject({
      type: "stable",
      label: "—",
    });
  });

  it("supports month gap approximations and record totals", () => {
    expect(monthsBetween("2014-07-15", "2015-01-15")).toBeCloseTo(6, 1);
    expect(sumRecordValues({ 2013: 100, 2014: 250 })).toBe(350);
  });
});
