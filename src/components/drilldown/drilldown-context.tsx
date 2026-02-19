"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";

const EXIT_DURATION = 300;

interface DrilldownPanel {
  id: string;
  content: ReactNode;
  exiting?: boolean;
}

interface DrilldownContextType {
  /** Active panels only (excludes exiting) — use for logic like nesting depth */
  panels: DrilldownPanel[];
  /** All panels including exiting — use for rendering */
  allPanels: DrilldownPanel[];
  push: (id: string, content: ReactNode) => void;
  pop: () => void;
  popAll: () => void;
  isOpen: boolean;
}

const DrilldownContext = createContext<DrilldownContextType | null>(null);

export function DrilldownProvider({ children }: { children: ReactNode }) {
  const [panels, setPanels] = useState<DrilldownPanel[]>([]);
  const cleanupTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  // Schedule removal of exiting panels after the animation duration
  const scheduleCleanup = useCallback(() => {
    const timer = setTimeout(() => {
      setPanels((prev) => prev.filter((p) => !p.exiting));
      cleanupTimers.current.delete(timer);
    }, EXIT_DURATION);
    cleanupTimers.current.add(timer);
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      cleanupTimers.current.forEach(clearTimeout);
    };
  }, []);

  const push = useCallback((id: string, content: ReactNode) => {
    setPanels((prev) => [...prev, { id, content }]);
  }, []);

  const pop = useCallback(() => {
    setPanels((prev) => {
      if (prev.length === 0) return prev;
      // Find the last non-exiting panel and mark it as exiting
      const lastActiveIndex = prev.findLastIndex((p) => !p.exiting);
      if (lastActiveIndex === -1) return prev;
      const next = [...prev];
      next[lastActiveIndex] = { ...next[lastActiveIndex], exiting: true };
      return next;
    });
    scheduleCleanup();
  }, [scheduleCleanup]);

  const popAll = useCallback(() => {
    setPanels((prev) => {
      if (prev.length === 0) return prev;
      return prev.map((p) => (p.exiting ? p : { ...p, exiting: true }));
    });
    scheduleCleanup();
  }, [scheduleCleanup]);

  // Escape key pops the top panel (only if no Radix overlay is open)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // If a popover/select/dropdown/dialog is open, let Radix handle the Escape first
        if (document.querySelector("[data-radix-popper-content-wrapper], [data-radix-select-viewport], [data-radix-menu-content], [role=\"dialog\"][data-state=\"open\"]")) return;
        pop();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [pop]);

  // Derived: active panels (non-exiting) for logic
  const activePanels = panels.filter((p) => !p.exiting);
  const isOpen = activePanels.length > 0;

  return (
    <DrilldownContext.Provider
      value={{
        panels: activePanels,
        allPanels: panels,
        push,
        pop,
        popAll,
        isOpen,
      }}
    >
      {children}
    </DrilldownContext.Provider>
  );
}

export function useDrilldown() {
  const context = useContext(DrilldownContext);
  if (!context) {
    throw new Error("useDrilldown must be used within a DrilldownProvider");
  }
  return context;
}
