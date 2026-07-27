import type {
  CutoffStatus,
  HistoricalBulletinRow,
  TrackerCategoryKey,
} from "@/data/trackerData";
import { fmtDateStr, movementLabel } from "@/lib/trackerUtils";

export type DateKind = "fad" | "dof";

export type CategoryDateKey =
  | "eb1_fad"
  | "eb1_dof"
  | "eb2_fad"
  | "eb2_dof"
  | "eb3_fad"
  | "eb3_dof";

export type CategoryStatusKey =
  | "eb1_fad_status"
  | "eb1_dof_status"
  | "eb2_fad_status"
  | "eb2_dof_status"
  | "eb3_fad_status"
  | "eb3_dof_status";

export function categoryDateKey(
  category: TrackerCategoryKey,
  kind: DateKind
): CategoryDateKey {
  if (category === "EB1") return kind === "fad" ? "eb1_fad" : "eb1_dof";
  if (category === "EB3") return kind === "fad" ? "eb3_fad" : "eb3_dof";
  return kind === "fad" ? "eb2_fad" : "eb2_dof";
}

export function categoryStatusKey(
  category: TrackerCategoryKey,
  kind: DateKind
): CategoryStatusKey {
  if (category === "EB1")
    return kind === "fad" ? "eb1_fad_status" : "eb1_dof_status";
  if (category === "EB3")
    return kind === "fad" ? "eb3_fad_status" : "eb3_dof_status";
  return kind === "fad" ? "eb2_fad_status" : "eb2_dof_status";
}

export function cutoffDateLabel(
  date: string,
  status: CutoffStatus = "available"
): string {
  return status === "unavailable" ? "Unavailable" : fmtDateStr(date);
}

export function rowCutoffStatus(
  row: HistoricalBulletinRow,
  category: TrackerCategoryKey,
  kind: DateKind
): CutoffStatus {
  return row[categoryStatusKey(category, kind)] ?? "available";
}

export function rowCutoffDateLabel(
  row: HistoricalBulletinRow,
  category: TrackerCategoryKey,
  kind: DateKind
): string {
  return cutoffDateLabel(
    row[categoryDateKey(category, kind)],
    rowCutoffStatus(row, category, kind)
  );
}

export function rowCutoffMovement(
  previous: HistoricalBulletinRow | null,
  current: HistoricalBulletinRow,
  category: TrackerCategoryKey,
  kind: DateKind
): ReturnType<typeof movementLabel> | null {
  if (!previous) return null;
  if (
    rowCutoffStatus(previous, category, kind) === "unavailable" ||
    rowCutoffStatus(current, category, kind) === "unavailable"
  ) {
    return null;
  }
  const key = categoryDateKey(category, kind);
  return movementLabel(previous[key], current[key]);
}
