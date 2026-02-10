"use client";

import { format, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import type { Project } from "@/db/schema";

interface MilestoneCardProps {
  milestone: Project;
  featureCount: number;
  completedFeatureCount: number;
  onClick: () => void;
}

export function MilestoneCard({
  milestone,
  featureCount,
  completedFeatureCount,
  onClick,
}: MilestoneCardProps) {
  const progress =
    featureCount > 0
      ? Math.round((completedFeatureCount / featureCount) * 100)
      : 0;

  const startDate = milestone.startDate
    ? new Date(milestone.startDate)
    : null;
  const endDate = milestone.endDate ? new Date(milestone.endDate) : null;

  const daysRemaining =
    endDate && endDate > new Date()
      ? differenceInDays(endDate, new Date())
      : null;

  const isOverdue = endDate && endDate < new Date() && progress < 100;
  const isCompleted = progress === 100;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
      className={cn(
        "group/row relative flex items-center gap-3 px-6 py-3.5",
        "cursor-pointer transition-colors",
        "hover:bg-accent/40",
        "focus-visible:outline-none focus-visible:bg-accent/40"
      )}
    >
      {/* Status dot */}
      <span
        className={cn(
          "h-2 w-2 rounded-full shrink-0",
          isCompleted
            ? "bg-green-500"
            : isOverdue
              ? "bg-destructive"
              : progress > 0
                ? "bg-primary"
                : "bg-muted-foreground/40"
        )}
      />

      {/* Content */}
      <div className="min-w-0 flex-1 flex flex-col gap-0.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium truncate">
            {milestone.name}
          </span>

          {/* Status label */}
          {isCompleted ? (
            <span className="text-xs font-medium text-green-600 dark:text-green-400 shrink-0">
              Complete
            </span>
          ) : isOverdue ? (
            <span className="text-xs font-medium text-destructive shrink-0">
              Overdue
            </span>
          ) : daysRemaining !== null ? (
            <span className="text-xs text-muted-foreground shrink-0">
              {daysRemaining}d left
            </span>
          ) : null}
        </div>

        {milestone.description && (
          <p className="text-xs text-muted-foreground truncate">
            {milestone.description}
          </p>
        )}
      </div>

      {/* Right-side metadata */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Date range */}
        <span className="text-xs text-muted-foreground hidden sm:block">
          {startDate ? format(startDate, "MMM d") : "—"}
          {" – "}
          {endDate ? format(endDate, "MMM d") : "—"}
        </span>

        {/* Feature count + progress */}
        {featureCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground tabular-nums">
              {completedFeatureCount}/{featureCount}
            </span>
            <div className="w-10 h-1.5 bg-muted rounded-full overflow-hidden hidden sm:block">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500 ease-out",
                  isCompleted
                    ? "bg-green-500"
                    : isOverdue
                      ? "bg-destructive"
                      : "bg-primary"
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
