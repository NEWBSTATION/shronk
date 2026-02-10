"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

// Sidebar width constraints (in pixels)
export const SIDEBAR_MIN_WIDTH = 200;
export const SIDEBAR_MAX_WIDTH = 400;
export const SIDEBAR_DEFAULT_WIDTH = 288; // 18rem = 288px

// Feature sheet width constraints (in pixels)
export const FEATURE_SHEET_MIN_WIDTH = 420;
export const FEATURE_SHEET_MAX_WIDTH = 900;
export const FEATURE_SHEET_DEFAULT_WIDTH = 560;

interface LayoutStore {
  // Sidebar width in pixels
  sidebarWidth: number;
  // Feature sheet width in pixels
  featureSheetWidth: number;

  // Actions
  setSidebarWidth: (width: number) => void;
  resetSidebarWidth: () => void;
  setFeatureSheetWidth: (width: number) => void;
  resetFeatureSheetWidth: () => void;
}

export const useLayoutStore = create<LayoutStore>()(
  persist(
    (set) => ({
      sidebarWidth: SIDEBAR_DEFAULT_WIDTH,
      featureSheetWidth: FEATURE_SHEET_DEFAULT_WIDTH,

      setSidebarWidth: (width) =>
        set({
          sidebarWidth: Math.min(
            SIDEBAR_MAX_WIDTH,
            Math.max(SIDEBAR_MIN_WIDTH, width)
          ),
        }),

      resetSidebarWidth: () => set({ sidebarWidth: SIDEBAR_DEFAULT_WIDTH }),

      setFeatureSheetWidth: (width) =>
        set({
          featureSheetWidth: Math.min(
            FEATURE_SHEET_MAX_WIDTH,
            Math.max(FEATURE_SHEET_MIN_WIDTH, width)
          ),
        }),

      resetFeatureSheetWidth: () =>
        set({ featureSheetWidth: FEATURE_SHEET_DEFAULT_WIDTH }),
    }),
    {
      name: "shronk-layout-storage",
      partialize: (state) => ({
        sidebarWidth: state.sidebarWidth,
        featureSheetWidth: state.featureSheetWidth,
      }),
    }
  )
);
