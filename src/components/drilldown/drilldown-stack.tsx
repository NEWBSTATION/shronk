"use client";

import { useEffect, useRef, useCallback } from "react";
import { useDrilldown } from "./drilldown-context";
import { cn } from "@/lib/utils";

export function DrilldownStack() {
  const { panels, allPanels, pop } = useDrilldown();
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const activeCount = panels.length;

  // Click-outside-to-close: mousedown anywhere outside the active card pops
  const popRef = useRef(pop);
  popRef.current = pop;
  useEffect(() => {
    if (activeCount === 0) return;

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Check if click is inside any active panel card
      for (const el of cardRefs.current.values()) {
        if (el.contains(target)) return;
      }

      // Ignore clicks inside Radix portals (Select, Popover, DropdownMenu, Dialog, etc.)
      if (target.closest("[data-radix-popper-content-wrapper], [role=\"dialog\"], [data-radix-select-viewport], [data-radix-menu-content]")) return;

      popRef.current();
    };

    // Delay listener attachment by a frame to avoid the same click
    // that opened the panel from immediately closing it.
    // Use capture phase so no library can swallow the event
    // with stopPropagation before we see it.
    const raf = requestAnimationFrame(() => {
      document.addEventListener("mousedown", handleMouseDown, true);
    });
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("mousedown", handleMouseDown, true);
    };
  }, [activeCount]);

  const setCardRef = useCallback(
    (index: number, el: HTMLDivElement | null) => {
      if (el) cardRefs.current.set(index, el);
      else cardRefs.current.delete(index);
    },
    []
  );

  if (allPanels.length === 0) return null;

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
              "absolute inset-0 flex justify-center transition-all duration-300 ease-out overflow-y-auto",
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
          >
            <div
              ref={(el) => setCardRef(index, el)}
              className="w-[600px] pb-8"
            >
              {panel.content}
            </div>
          </div>
        );
      })}
    </>
  );
}
