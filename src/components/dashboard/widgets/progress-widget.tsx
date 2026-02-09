"use client";

import { useMemo } from "react";
import { Calendar, ArrowRight, Clock } from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";
import { Progress } from "@/components/ui/progress";
import type { WidgetProps } from "../widget-renderer";
import { filterMilestones } from "../widget-data-utils";

export function ProgressWidget({
  config,
  milestones,
  globalFilters,
}: WidgetProps) {
  const filtered = useMemo(
    () => filterMilestones(milestones, globalFilters, config.settings.filters),
    [milestones, globalFilters, config.settings.filters]
  );

  const timeline = useMemo(() => {
    if (!filtered.length) return null;
    const starts = filtered.map((m) => new Date(m.startDate).getTime());
    const ends = filtered.map((m) => new Date(m.endDate).getTime());
    const earliest = new Date(Math.min(...starts));
    const latest = new Date(Math.max(...ends));
    const today = new Date();
    const totalDays = differenceInCalendarDays(latest, earliest) || 1;
    const elapsed = Math.max(0, differenceInCalendarDays(today, earliest));
    const remaining = Math.max(0, differenceInCalendarDays(latest, today));
    const completed = filtered.filter((m) => m.status === "completed").length;
    const percentComplete =
      filtered.length > 0
        ? Math.round((completed / filtered.length) * 100)
        : 0;
    const timeElapsedPercent = Math.min(
      100,
      Math.round((elapsed / totalDays) * 100)
    );
    return { earliest, latest, remaining, percentComplete, timeElapsedPercent };
  }, [filtered]);

  if (!timeline) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No timeline data
      </p>
    );
  }

  return (
    <div className="h-full flex flex-col justify-center space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          {format(timeline.earliest, "MMM d, yyyy")}
        </span>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          {format(timeline.latest, "MMM d, yyyy")}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Feature completion</span>
          <span className="font-medium">{timeline.percentComplete}%</span>
        </div>
        <Progress value={timeline.percentComplete} className="h-2" />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Time elapsed</span>
          <span className="font-medium">{timeline.timeElapsedPercent}%</span>
        </div>
        <Progress value={timeline.timeElapsedPercent} className="h-2" />
      </div>

      <div className="flex items-center gap-1.5 text-sm">
        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">
          {timeline.remaining > 0
            ? `${timeline.remaining} days remaining`
            : "Past deadline"}
        </span>
      </div>
    </div>
  );
}
