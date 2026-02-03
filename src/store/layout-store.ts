"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

// Sidebar width constraints (in pixels)
export const SIDEBAR_MIN_WIDTH = 200;
export const SIDEBAR_MAX_WIDTH = 400;
export const SIDEBAR_DEFAULT_WIDTH = 288; // 18rem = 288px

interface LayoutStore {
  // Sidebar width in pixels
  sidebarWidth: number;

  // Actions
  setSidebarWidth: (width: number) => void;
  resetSidebarWidth: () => void;
}

export const useLayoutStore = create<LayoutStore>()(
  persist(
    (set) => ({
      sidebarWidth: SIDEBAR_DEFAULT_WIDTH,

      setSidebarWidth: (width) =>
        set({
          sidebarWidth: Math.min(
            SIDEBAR_MAX_WIDTH,
            Math.max(SIDEBAR_MIN_WIDTH, width)
          ),
        }),

      resetSidebarWidth: () => set({ sidebarWidth: SIDEBAR_DEFAULT_WIDTH }),
    }),
    {
      name: "shronk-layout-storage",
      partialize: (state) => ({
        sidebarWidth: state.sidebarWidth,
      }),
    }
  )
);
