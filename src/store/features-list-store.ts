"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface FeaturesListStore {
  collapsedSections: Set<string>;
  selectedIds: Set<string>;
  selectMode: boolean;

  toggleSection: (id: string) => void;
  expandAll: () => void;
  collapseAll: (ids: string[]) => void;
  toggleSelected: (id: string) => void;
  rangeSelect: (ids: string[]) => void;
  clearSelection: () => void;
}

export const useFeaturesListStore = create<FeaturesListStore>()(
  persist(
    (set) => ({
      collapsedSections: new Set<string>(),
      selectedIds: new Set<string>(),
      selectMode: false,

      toggleSection: (id) =>
        set((state) => {
          const next = new Set(state.collapsedSections);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return { collapsedSections: next };
        }),

      expandAll: () => set({ collapsedSections: new Set() }),

      collapseAll: (ids) => set({ collapsedSections: new Set(ids) }),

      toggleSelected: (id) =>
        set((state) => {
          const next = new Set(state.selectedIds);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          const selectMode = next.size > 0;
          return { selectedIds: next, selectMode };
        }),

      rangeSelect: (ids) =>
        set((state) => {
          const next = new Set(state.selectedIds);
          for (const id of ids) next.add(id);
          return { selectedIds: next, selectMode: next.size > 0 };
        }),

      clearSelection: () =>
        set({ selectedIds: new Set(), selectMode: false }),
    }),
    {
      name: "shronk-features-list-storage",
      partialize: (state) => ({
        collapsedSections: Array.from(state.collapsedSections),
      }),
      merge: (persisted: unknown, currentState) => {
        const p = persisted as { collapsedSections?: string[] } | undefined;
        return {
          ...currentState,
          collapsedSections: new Set(p?.collapsedSections ?? []),
        };
      },
    }
  )
);
