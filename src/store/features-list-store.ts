"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DurationUnit = "days" | "weeks" | "months" | "years";

interface FeaturesListStore {
  collapsedSections: Set<string>;
  selectedIds: Set<string>;
  selectMode: boolean;
  durationUnit: DurationUnit;

  toggleSection: (id: string) => void;
  expandAll: () => void;
  collapseAll: (ids: string[]) => void;
  toggleSelected: (id: string) => void;
  rangeSelect: (ids: string[]) => void;
  selectIds: (ids: string[]) => void;
  deselectIds: (ids: string[]) => void;
  clearSelection: () => void;
  setDurationUnit: (unit: DurationUnit) => void;
}

export const useFeaturesListStore = create<FeaturesListStore>()(
  persist(
    (set) => ({
      collapsedSections: new Set<string>(),
      selectedIds: new Set<string>(),
      selectMode: false,
      durationUnit: "days" as DurationUnit,

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

      selectIds: (ids) =>
        set((state) => {
          const next = new Set(state.selectedIds);
          for (const id of ids) next.add(id);
          return { selectedIds: next, selectMode: next.size > 0 };
        }),

      deselectIds: (ids) =>
        set((state) => {
          const next = new Set(state.selectedIds);
          for (const id of ids) next.delete(id);
          return { selectedIds: next, selectMode: next.size > 0 };
        }),

      clearSelection: () =>
        set({ selectedIds: new Set(), selectMode: false }),

      setDurationUnit: (unit) => set({ durationUnit: unit }),
    }),
    {
      name: "shronk-features-list-storage",
      partialize: (state) => ({
        collapsedSections: Array.from(state.collapsedSections),
        durationUnit: state.durationUnit,
      }),
      merge: (persisted: unknown, currentState) => {
        const p = persisted as { collapsedSections?: string[]; durationUnit?: DurationUnit } | undefined;
        return {
          ...currentState,
          collapsedSections: new Set(p?.collapsedSections ?? []),
          durationUnit: p?.durationUnit ?? "days",
        };
      },
    }
  )
);
