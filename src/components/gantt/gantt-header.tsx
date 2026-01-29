"use client";

import { cn } from "@/lib/utils";
import type { HeaderCell } from "./utils/date-calculations";

interface GanttHeaderProps {
  primaryCells: HeaderCell[];
  secondaryCells: HeaderCell[];
}

export function GanttHeader({ primaryCells, secondaryCells }: GanttHeaderProps) {
  return (
    <div className="sticky top-0 z-10 bg-background border-b">
      {/* Secondary row (months/years) */}
      {secondaryCells.length > 0 && (
        <div className="flex border-b h-9">
          {secondaryCells.map((cell, index) => (
            <div
              key={index}
              className="flex items-center justify-center text-xs font-medium text-muted-foreground border-r last:border-r-0 shrink-0"
              style={{ width: cell.width }}
            >
              {cell.label}
            </div>
          ))}
        </div>
      )}

      {/* Primary row (days/weeks/months) */}
      <div className="flex h-9">
        {primaryCells.map((cell, index) => (
          <div
            key={index}
            className={cn(
              "flex items-center justify-center text-xs font-medium border-r last:border-r-0 shrink-0",
              cell.isToday && "bg-primary/10 text-primary"
            )}
            style={{ width: cell.width }}
          >
            {cell.label}
          </div>
        ))}
      </div>
    </div>
  );
}
