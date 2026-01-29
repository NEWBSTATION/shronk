"use client";

import { cn } from "@/lib/utils";
import type { HeaderCell } from "./utils/date-calculations";

interface GanttHeaderProps {
  primaryCells: HeaderCell[];
  secondaryCells: HeaderCell[];
  headerHeight: number;
}

const ROW_HEIGHT = 28;

export function GanttHeader({ primaryCells, secondaryCells, headerHeight }: GanttHeaderProps) {
  return (
    <div className="sticky top-0 z-10 bg-background border-b" style={{ height: headerHeight }}>
      {/* Primary row (months/years - larger units) */}
      {secondaryCells.length > 0 && (
        <div className="flex border-b" style={{ height: ROW_HEIGHT }}>
          {secondaryCells.map((cell, index) => (
            <div
              key={index}
              className="flex items-center px-3 text-xs font-medium text-muted-foreground border-r border-border/30 shrink-0"
              style={{ width: cell.width }}
            >
              {cell.label}
            </div>
          ))}
        </div>
      )}

      {/* Secondary row (days/weeks - smaller units) */}
      <div className="flex" style={{ height: ROW_HEIGHT }}>
        {primaryCells.map((cell, index) => (
          <div
            key={index}
            className={cn(
              "flex items-center justify-center text-xs border-r border-border/50 shrink-0",
              cell.isToday && "bg-primary/10 font-semibold text-primary",
              cell.isWeekend && "bg-muted/30"
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
