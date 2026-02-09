"use client";

import { useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { StatusBadge } from "@/components/shared/status-badge";
import type { WidgetProps } from "../widget-renderer";
import { filterMilestones, sortByUpdated } from "../widget-data-utils";

export function ActivityWidget({
  config,
  milestones,
  globalFilters,
}: WidgetProps) {
  const limit = config.settings.itemLimit || 10;

  const filtered = useMemo(
    () => filterMilestones(milestones, globalFilters, config.settings.filters),
    [milestones, globalFilters, config.settings.filters]
  );

  const items = useMemo(
    () => sortByUpdated(filtered).slice(0, limit),
    [filtered, limit]
  );

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No recent activity
      </p>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-auto space-y-3">
      {items.map((m) => (
        <div key={m.id} className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <StatusBadge status={m.status} showLabel={false} />
            <span className="text-sm truncate">{m.title}</span>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {formatDistanceToNow(new Date(m.updatedAt), { addSuffix: true })}
          </span>
        </div>
      ))}
    </div>
  );
}
