import { SCENARIOS, type EB_CATEGORIES } from "@/data/trackerData";
import { cutoffDateLabel } from "@/lib/bulletinStatus";
import type { ForecastProjection } from "@/lib/forecast";
import { fmtDate, fmtDateStr, fmtDuration } from "@/lib/trackerUtils";

type CategoryMeta = (typeof EB_CATEGORIES)[keyof typeof EB_CATEGORIES];

type ExportTrackerPdfArgs = {
  category: CategoryMeta;
  targetDate: string;
  gapMonths: number;
  overviewProjection: ForecastProjection;
  projections: Record<string, ForecastProjection>;
  spilloverLevel: string;
  banContinues: string;
  wastageLevel: string;
  siteUrl: string;
};

export async function exportTrackerPdf({
  category,
  targetDate,
  gapMonths,
  overviewProjection,
  projections,
  spilloverLevel,
  banContinues,
  wastageLevel,
  siteUrl,
}: ExportTrackerPdfArgs) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  const contentW = pageW - margin * 2;
  let y = 0;

  const checkPage = (needed = 12) => {
    if (y + needed > 272) {
      doc.addPage();
      y = 20;
    }
  };

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 32, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("EB Priority Date Tracker", margin, 13);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text("India · EB-1, EB-2, EB-3 · Personalized Estimate", margin, 20);
  doc.text(`Generated: ${fmtDate(new Date())}`, margin, 26);
  doc.setTextColor(99, 179, 237);
  doc.textWithLink(siteUrl, pageW - margin - doc.getTextWidth(siteUrl), 26, {
    url: siteUrl,
  });
  y = 42;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("YOUR PRIORITY DATE", margin, y);
  y += 5;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, contentW, 22, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(fmtDateStr(targetDate), margin + 6, y + 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Category: ${category.label} — ${category.name}`,
    margin + 6,
    y + 16
  );

  const statX = margin + contentW * 0.45;
  const statCols = [
    {
      label: "CURRENT FAD",
      val: cutoffDateLabel(category.currentFAD, category.currentFADStatus),
    },
    {
      label: "GAP",
      val:
        category.currentFADStatus === "unavailable"
          ? "Unavailable"
          : fmtDuration(gapMonths),
    },
    {
      label: "CURRENT DOF",
      val: cutoffDateLabel(category.currentDoF, category.currentDoFStatus),
    },
  ];
  statCols.forEach((stat, index) => {
    const sx = statX + index * ((contentW * 0.55) / 3);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(stat.label, sx, y + 7);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(stat.val, sx, y + 14);
  });
  y += 30;

  checkPage(38);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("BEST CASE PROJECTION", margin, y);
  y += 4;
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(margin, y, contentW, 28, 2, 2, "F");
  const bestCaseColumns = [
    {
      label: "FILING DATE (DOF)",
      val: overviewProjection.isAlreadyCurrent
        ? "Current"
        : fmtDate(overviewProjection.dofDate),
      sub: "Can file I-485",
    },
    {
      label: "FINAL ACTION DATE",
      val: overviewProjection.isAlreadyCurrent
        ? "Current"
        : fmtDate(overviewProjection.fadDate),
      sub: "Visa becomes available",
    },
    {
      label: "GC RECEIPT EST.",
      val: overviewProjection.isAlreadyCurrent
        ? "Current"
        : fmtDate(overviewProjection.gcDate),
      sub: `~${fmtDuration(category.gcLagMonths)} after FAD`,
    },
    {
      label: "TIME TO FAD",
      val: fmtDuration(overviewProjection.monthsFromToday),
      sub: "Best case estimate",
    },
  ];
  bestCaseColumns.forEach((column, index) => {
    const cx = margin + 6 + index * (contentW / 4);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(column.label, cx, y + 8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(column.val, cx, y + 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(column.sub, cx, y + 22);
  });
  y += 36;

  checkPage(28);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("ASSUMPTION SETTINGS", margin, y);
  y += 4;
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, y, contentW, 16, 2, 2, "F");
  const assumptions = [
    {
      label: "Spillover",
      val: spilloverLevel.charAt(0).toUpperCase() + spilloverLevel.slice(1),
    },
    { label: "Ban Duration", val: `Through ${banContinues}` },
    {
      label: "Wastage",
      val: wastageLevel.charAt(0).toUpperCase() + wastageLevel.slice(1),
    },
  ];
  assumptions.forEach((assumption, index) => {
    const ax = margin + 6 + index * (contentW / 3);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(assumption.label.toUpperCase(), ax, y + 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(assumption.val, ax, y + 13);
  });
  y += 24;

  checkPage(12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("SCENARIO RANGE — ALL OUTCOMES", margin, y);
  y += 5;

  const cols = [
    "Scenario",
    "Probability",
    "DoF Estimate",
    "FAD Estimate",
    "GC Receipt",
    "Time to FAD",
  ];
  const colW = [32, 22, 32, 32, 32, 24];
  let cx2 = margin;
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, y, contentW, 7, "F");
  cols.forEach((column, index) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);
    doc.text(column, cx2 + 2, y + 4.8);
    cx2 += colW[index];
  });
  y += 7;

  const scenarioColors: Record<string, [number, number, number]> = {
    optimistic: [16, 185, 129],
    base: [59, 130, 246],
    conservative: [245, 158, 11],
    pessimistic: [239, 68, 68],
  };
  Object.entries(SCENARIOS).forEach(([key, scenario], rowIndex) => {
    checkPage(9);
    const projection = projections[key];
    const rowBg: [number, number, number] =
      rowIndex % 2 === 0 ? [248, 250, 252] : [255, 255, 255];
    doc.setFillColor(...rowBg);
    doc.rect(margin, y, contentW, 8, "F");
    const [r, g, b] = scenarioColors[key] ?? [100, 116, 139];
    doc.setFillColor(r, g, b);
    doc.rect(margin, y, 2.5, 8, "F");
    const rowData = [
      scenario.label,
      scenario.probability,
      projection.isAlreadyCurrent ? "Current" : fmtDate(projection.dofDate),
      projection.isAlreadyCurrent ? "Current" : fmtDate(projection.fadDate),
      projection.isAlreadyCurrent ? "Current" : fmtDate(projection.gcDate),
      projection.isAlreadyCurrent
        ? "0"
        : fmtDuration(projection.monthsFromToday),
    ];
    let rx = margin + 3.5;
    rowData.forEach((cell, index) => {
      doc.setFont("helvetica", index === 0 ? "bold" : "normal");
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(cell, rx, y + 5.2);
      rx += colW[index];
    });
    y += 8;
  });
  y += 8;

  checkPage(30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("METHODOLOGY", margin, y);
  y += 5;
  const methodLines = [
    "Uses a probabilistic month-by-month simulator for both FAD and DoF, rather than a single gap divided by one static rate.",
    "Each simulated bulletin month samples historical seasonality and volatility, then adjusts movement for demand density using USCIS I-485 inventory with scaled I-140 fallback data.",
    "Scenario assumptions still control the base FAD rate through spillover, ban duration, and wastage multipliers.",
    "Displayed dates are medians (P50) with an 80% interval, and the backtest badge reports 6-month FAD forecast MAE and interval hit rate.",
  ];
  methodLines.forEach(line => {
    checkPage(6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    const wrapped = doc.splitTextToSize(line, contentW);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 4.5;
  });
  y += 6;

  checkPage(16);
  doc.setFillColor(254, 243, 199);
  doc.roundedRect(margin, y, contentW, 14, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(146, 64, 14);
  doc.text("DISCLAIMER", margin + 4, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(120, 53, 15);
  const disclaimer =
    "Estimates are based on historical trends and current policy. Actual timelines may vary significantly. This is not legal advice — consult a licensed immigration attorney for guidance specific to your situation.";
  const dLines = doc.splitTextToSize(disclaimer, contentW - 8);
  doc.text(dLines, margin + 4, y + 10);

  const totalPages =
    (
      doc.internal as { getNumberOfPages?: () => number }
    ).getNumberOfPages?.() ?? 1;
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${page} of ${totalPages}`, pageW - margin, 290, {
      align: "right",
    });
    doc.setTextColor(99, 179, 237);
    doc.textWithLink(siteUrl, margin, 290, { url: siteUrl });
  }

  doc.save(`EB-Estimate-${fmtDateStr(targetDate).replace(/[, ]/g, "")}.pdf`);
}
