"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  ColumnSizingState,
  ColumnOrderState,
  VisibilityState,
} from "@tanstack/react-table";

interface FeaturesTableStore {
  columnSizing: ColumnSizingState;
  columnOrder: ColumnOrderState;
  columnVisibility: VisibilityState;

  setColumnSizing: (
    updater: ColumnSizingState | ((prev: ColumnSizingState) => ColumnSizingState)
  ) => void;
  setColumnOrder: (
    updater: ColumnOrderState | ((prev: ColumnOrderState) => ColumnOrderState)
  ) => void;
  setColumnVisibility: (
    updater: VisibilityState | ((prev: VisibilityState) => VisibilityState)
  ) => void;
}

export const useFeaturesTableStore = create<FeaturesTableStore>()(
  persist(
    (set, get) => ({
      columnSizing: {},
      columnOrder: [],
      columnVisibility: {},

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
    }),
    {
      name: "shronk-features-table-storage",
    }
  )
);
