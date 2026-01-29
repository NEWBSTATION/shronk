"use client";

interface GanttTodayIndicatorProps {
  position: number;
}

export function GanttTodayIndicator({ position }: GanttTodayIndicatorProps) {
  return (
    <div
      className="absolute top-0 bottom-0 w-0.5 bg-destructive z-20 pointer-events-none"
      style={{ left: position }}
    >
      {/* Pulsing dot at top */}
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-destructive animate-pulse" />
    </div>
  );
}
