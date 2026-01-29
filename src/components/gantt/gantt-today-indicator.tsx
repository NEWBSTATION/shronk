"use client";

interface GanttTodayIndicatorProps {
  position: number;
}

export function GanttTodayIndicator({ position }: GanttTodayIndicatorProps) {
  return (
    <div
      className="absolute top-0 bottom-0 w-0.5 bg-primary z-20 pointer-events-none"
      style={{ left: position }}
    >
      {/* Animated glow */}
      <div className="absolute inset-0 bg-primary animate-pulse opacity-50" />

      {/* Top marker */}
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-primary shadow-sm" />

      {/* "Today" label */}
      <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap">
        Today
      </div>
    </div>
  );
}
