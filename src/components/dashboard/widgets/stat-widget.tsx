"use client";

import { useMemo } from "react";
import {
  Layers,
  Play,
  CircleCheck,
  ArrowRight,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import type { WidgetProps } from "../widget-renderer";
import { filterMilestones, getUpNextFeatures } from "../widget-data-utils";

const metricConfig: Record<
  string,
  { icon: React.ElementType; getDescription: (val: number, total: number) => string }
> = {
  total: {
    icon: Layers,
    getDescription: () => "In this project",
  },
  in_progress: {
    icon: Play,
    getDescription: () => "Currently active",
  },
  completed: {
    icon: CircleCheck,
    getDescription: (val, total) =>
      total > 0 ? `${Math.round((val / total) * 100)}% done` : "No features",
  },
  up_next: {
    icon: ArrowRight,
    getDescription: () => "Ready to start",
  },
  overdue: {
    icon: AlertTriangle,
    getDescription: () => "Past end date",
  },
  avg_progress: {
    icon: TrendingUp,
    getDescription: () => "Average progress",
  },
};

export function StatWidget({
  config,
  milestones,
  dependencies,
  globalFilters,
}: WidgetProps) {
  const metric = config.settings.metric || "total";
  const filtered = useMemo(
    () => filterMilestones(milestones, globalFilters, config.settings.filters),
    [milestones, globalFilters, config.settings.filters]
  );

  const value = useMemo(() => {
    switch (metric) {
      case "total":
        return filtered.length;
      case "in_progress":
        return filtered.filter((m) => m.status === "in_progress").length;
      case "completed":
        return filtered.filter((m) => m.status === "completed").length;
      case "up_next":
        return getUpNextFeatures(filtered, dependencies).length;
      case "overdue": {
        const now = new Date();
        return filtered.filter(
          (m) =>
            m.status !== "completed" &&
            m.status !== "cancelled" &&
            new Date(m.endDate) < now
        ).length;
      }
      case "avg_progress":
        return filtered.length > 0
          ? Math.round(
              filtered.reduce((sum, m) => sum + m.progress, 0) / filtered.length
            )
          : 0;
      default:
        return 0;
    }
  }, [metric, filtered, dependencies]);

  const cfg = metricConfig[metric] || metricConfig.total;
  const Icon = cfg.icon;

  return (
    <div className="h-full flex flex-col justify-center">
      <div className="flex items-center justify-between mb-1">
        <div className="text-2xl font-bold">{value}{metric === "avg_progress" ? "%" : ""}</div>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="text-xs text-muted-foreground">
        {cfg.getDescription(value, filtered.length)}
      </p>
    </div>
  );
}
