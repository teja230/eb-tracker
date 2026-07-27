import type { TrackerCategoryKey } from "@/data/trackerData";
import type { BacktestSummary, ForecastProjection } from "@/lib/forecast";
import type { MovementInfo } from "@/lib/trackerUtils";

export type ScenarioKey =
  | "optimistic"
  | "base"
  | "conservative"
  | "pessimistic";

export type ScenarioMeta = {
  label: string;
  probability: string;
  color: string;
  description: string;
};

export type SourceLink = {
  label: string;
  href: string;
  detail: string;
};

export type SensitivityRow = {
  control: string;
  value: string;
  months: number;
  dateLabel: string;
  deltaMonths: number;
  selected: boolean;
};

export type CategoryComparisonRow = {
  category: TrackerCategoryKey;
  label: string;
  name: string;
  currentFadLabel: string;
  currentDofLabel: string;
  fadMove: MovementInfo | null;
  dofMove: MovementInfo | null;
  prevBulletinLabel: string;
  gapLabel: string;
  fadEstLabel: string; // base-case FAD estimate
  isSelected: boolean; // is this the currently selected category?
};

export type AskEBTrackerProps = {
  categoryLabel: string;
  categoryName: string;
  targetDate: string;
  currentFad: string;
  currentDof: string;
  projections: Record<string, ForecastProjection>;
  scenarios: Record<string, ScenarioMeta>;
  assumptionsSummary: string;
  backtest: BacktestSummary;
  sourceLinks: SourceLink[];
  onClose?: () => void;
};
