"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  ColumnSizingState,
  ColumnOrderState,
  VisibilityState,
} from "@tanstack/react-table";

export type DurationDisplayUnit = "auto" | "days" | "weeks" | "months" | "years";

interface FeaturesTableStore {
  columnSizing: ColumnSizingState;
  columnOrder: ColumnOrderState;
  columnVisibility: VisibilityState;
  durationDisplayUnit: DurationDisplayUnit;

  setColumnSizing: (
    updater: ColumnSizingState | ((prev: ColumnSizingState) => ColumnSizingState)
  ) => void;
  setColumnOrder: (
    updater: ColumnOrderState | ((prev: ColumnOrderState) => ColumnOrderState)
  ) => void;
  setColumnVisibility: (
    updater: VisibilityState | ((prev: VisibilityState) => VisibilityState)
  ) => void;
  setDurationDisplayUnit: (unit: DurationDisplayUnit) => void;
}

export const useFeaturesTableStore = create<FeaturesTableStore>()(
  persist(
    (set, get) => ({
      columnSizing: {},
      columnOrder: [],
      columnVisibility: {},
      durationDisplayUnit: "auto",

      setColumnSizing: (updater) =>
        set({
          columnSizing:
            typeof updater === "function"
              ? updater(get().columnSizing)
              : updater,
        }),
      setColumnOrder: (updater) =>
        set({
          columnOrder:
            typeof updater === "function"
              ? updater(get().columnOrder)
              : updater,
        }),
      setColumnVisibility: (updater) =>
        set({
          columnVisibility:
            typeof updater === "function"
              ? updater(get().columnVisibility)
              : updater,
        }),
      setDurationDisplayUnit: (unit) =>
        set({ durationDisplayUnit: unit }),
    }),
    {
      name: "shronk-features-table-storage",
    }
  )
);
