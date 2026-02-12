"use client";

import { useDrilldown } from "./drilldown-context";
import { cn } from "@/lib/utils";

export function DrilldownStack() {
  const { panels, allPanels, pop } = useDrilldown();

  if (allPanels.length === 0) return null;

  const activeCount = panels.length;

  return (
    <>
      {allPanels.map((panel, index) => {
        const isExiting = !!panel.exiting;
        const activeIndex = panels.indexOf(panel);
        const isActive = !isExiting && activeIndex === activeCount - 1;
        const depth = isExiting ? 0 : activeCount - 1 - activeIndex;

        return (
          <div
            key={panel.id + "-" + index}
            className={cn(
              "absolute inset-0 flex justify-end p-3 transition-all duration-300 ease-out",
              // Active (top of stack) — fully visible
              isActive && "translate-x-0 opacity-100",
              // Behind (1 level back) — slid left, blurred, dimmed
              !isExiting &&
                depth === 1 &&
                "-translate-x-full md:-translate-x-[900px] blur-[2px] opacity-50 pointer-events-none",
              // Behind (2+ levels back) — further left, more dim
              !isExiting &&
                depth >= 2 &&
                "-translate-x-[200%] md:-translate-x-[1800px] blur-[2px] opacity-30 pointer-events-none",
              // Exiting — slides right and fades out
              isExiting &&
                "translate-x-full md:translate-x-[400px] opacity-0 pointer-events-none"
            )}
            onClick={(e) => {
              // Click-to-close: clicking the viewport background (not content) pops
              if (isActive && e.target === e.currentTarget) {
                pop();
              }
            }}
          >
            <div
              className="w-full md:w-[600px] rounded-2xl border border-border/60 bg-background shadow-lg shadow-black/[0.08] dark:shadow-black/25 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {panel.content}
            </div>
          </div>
        );
      })}
    </>
  );
}
