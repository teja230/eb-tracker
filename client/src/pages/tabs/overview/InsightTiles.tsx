import { AlertTriangle, Calendar, TrendingUp } from "lucide-react";

import { Card } from "@/components/ui/card";
import { CURRENT_BULLETIN } from "@/data/trackerData";

type InsightTilesProps = {
  recentPaceInsight: { headline: string; detail: string } | null | undefined;
  pendingInventoryTotal: number;
};

export function InsightTiles({
  recentPaceInsight,
  pendingInventoryTotal,
}: InsightTilesProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <TrendingUp className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
              Recent Pace
            </p>
            <p className="text-sm font-bold text-slate-900">
              {recentPaceInsight?.headline ?? "Waiting for data"}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {recentPaceInsight?.detail ??
                "Need at least two bulletin rows to compute a monthly movement."}
            </p>
          </div>
        </div>
      </Card>
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <Calendar className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
              Pending Inventory
            </p>
            <p className="text-sm font-bold text-slate-900">
              {pendingInventoryTotal.toLocaleString()} I-485s
            </p>
            <p className="text-xs text-slate-500 mt-1">
              USCIS Oct 2025 filed I-485 inventory used by the demand model.
              This does not include future demand that has not yet reached the
              filing stage.
            </p>
          </div>
        </div>
      </Card>
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
              Key Risk
            </p>
            <p className="text-sm font-bold text-slate-900">
              Retrogression possible
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {CURRENT_BULLETIN.month} bulletin notes that retrogression may be
              necessary later in the fiscal year.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
