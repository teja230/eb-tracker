import { AlertTriangle, ExternalLink, Info, ShieldCheck } from "lucide-react";
import { Link } from "wouter";

import { Card } from "@/components/ui/card";

import type { SourceLink } from "./trackerTypes";

export function TrustAndLimitationsPanel({
  sourceLinks,
}: {
  sourceLinks: SourceLink[];
}) {
  return (
    <Card className="border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <p className="text-sm font-bold text-slate-900">What it does</p>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            Calculates category-specific forecast ranges from current bulletin
            data, historical movement, demand density, and selected assumptions.
          </p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <p className="text-sm font-bold text-slate-900">What can change</p>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            Retrogression, USCIS chart selection, visa number use, policy
            changes, and processing capacity can shift results quickly.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-slate-600" />
            <p className="text-sm font-bold text-slate-900">What it is not</p>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            It is not legal advice, a USCIS filing determination, or a guarantee
            that a future bulletin will follow the modeled path.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {[
          { label: "EB-1 India guide", to: "/eb-1-india" },
          { label: "EB-2 India guide", to: "/eb-2-india" },
          { label: "EB-3 India guide", to: "/eb-3-india" },
          { label: "Methodology", to: "/methodology" },
          { label: "Bulletin history", to: "/visa-bulletin-history" },
        ].map(link => (
          <Link
            key={link.to}
            href={link.to}
            className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400 hover:text-slate-900"
          >
            {link.label}
          </Link>
        ))}
        {sourceLinks.map(source => (
          <a
            key={source.href}
            href={source.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400 hover:text-slate-900"
          >
            {source.label}
            <ExternalLink className="h-3 w-3" />
          </a>
        ))}
      </div>
    </Card>
  );
}
