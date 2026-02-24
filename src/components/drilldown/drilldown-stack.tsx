"use client";

import { useEffect, useRef, useCallback } from "react";
import { useDrilldown } from "./drilldown-context";
import { cn } from "@/lib/utils";

/**
 * Selectors that identify floating overlay elements the drilldown should ignore
 * (Radix UI portals, TipTap slash menu, etc.)
 */
const OVERLAY_IGNORE_SELECTOR = [
  "[data-radix-popper-content-wrapper]",
  "[data-radix-menu-content]",
  "[role='dialog']",
  "[role='listbox']",
  "[data-floating-menu]",
].join(", ");

export function DrilldownStack() {
  const { panels, allPanels, pop } = useDrilldown();
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const activeCount = panels.length;

  // Track whether a Radix floating overlay was recently open.
  // DOM-based checks at the moment of pointerdown are unreliable because Radix
  // may tear down its content (pointerdown → state update → React re-render)
  // before our handler inspects the DOM. Instead, a MutationObserver watches
  // for overlay nodes being removed and sets a brief cooldown.
  const overlayOpenRef = useRef(false);
  const overlayCooldownRef = useRef(false);

  useEffect(() => {
    if (activeCount === 0) {
      overlayOpenRef.current = false;
      overlayCooldownRef.current = false;
      return;
    }

    let cooldownTimer: ReturnType<typeof setTimeout>;

    const checkForOverlays = () => {
      return !!document.querySelector(OVERLAY_IGNORE_SELECTOR);
    };

    const observer = new MutationObserver(() => {
      const hasOverlay = checkForOverlays();

      if (overlayOpenRef.current && !hasOverlay) {
        // Overlay just closed — set a cooldown so the triggering pointerdown
        // (which caused the close) doesn't also pop the drilldown.
        overlayCooldownRef.current = true;
        clearTimeout(cooldownTimer);
        cooldownTimer = setTimeout(() => {
          overlayCooldownRef.current = false;
        }, 100);
      }

      overlayOpenRef.current = hasOverlay;
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-state"],
    });

    return () => {
      observer.disconnect();
      clearTimeout(cooldownTimer);
    };
  }, [activeCount]);

  // Click-outside-to-close
  const popRef = useRef(pop);
  popRef.current = pop;
  useEffect(() => {
    if (activeCount === 0) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;

      // Check if click is inside any active panel card
      for (const el of cardRefs.current.values()) {
        if (el.contains(target)) return;
      }

      // If a floating overlay is currently open or was very recently closed,
      // this click is dismissing that overlay — not the drilldown.
      if (overlayOpenRef.current || overlayCooldownRef.current) return;

      // Ignore clicks inside Radix portals / floating menus.
      // Walk up manually to handle SVG elements where closest() may not
      // cross namespace boundaries reliably.
      let node: Node | null = target;
      while (node) {
        if (
          node instanceof HTMLElement &&
          node.matches(OVERLAY_IGNORE_SELECTOR)
        )
          return;
        node = node.parentNode;
      }

      popRef.current();
    };

    // Delay listener attachment by a frame to avoid the same click
    // that opened the panel from immediately closing it.
    // Use capture phase so no library can swallow the event
    // with stopPropagation before we see it.
    const raf = requestAnimationFrame(() => {
      document.addEventListener("pointerdown", handlePointerDown, true);
    });
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("pointerdown", handlePointerDown, true);
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
              "absolute inset-0 flex justify-center transition-all duration-300 ease-out overflow-y-auto [scrollbar-gutter:stable]",
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
              className="w-full md:w-[600px] px-4 md:px-0 pb-8"
            >
              {panel.content}
            </div>
          </div>
        );
      })}
    </>
  );
}
