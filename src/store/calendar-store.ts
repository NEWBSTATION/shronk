"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CalendarViewType = "dayGridMonth" | "timeGridWeek" | "timeGridDay";

interface CalendarStore {
  // View preference
  viewType: CalendarViewType;

  // Team visibility (null = uninitialized, [] = user explicitly hid all)
  visibleTeamIds: string[] | null;

  // Actions
  setViewType: (viewType: CalendarViewType) => void;
  setVisibleTeamIds: (ids: string[] | null) => void;
  toggleTeamVisibility: (teamId: string) => void;
}

export const useCalendarStore = create<CalendarStore>()(
  persist(
    (set, get) => ({
      viewType: "dayGridMonth",
      visibleTeamIds: null,

      setViewType: (viewType) => set({ viewType }),

      setVisibleTeamIds: (visibleTeamIds) => set({ visibleTeamIds }),

      toggleTeamVisibility: (teamId) =>
        set((state) => {
          const current = state.visibleTeamIds ?? [];
          return {
            visibleTeamIds: current.includes(teamId)
              ? current.filter((id) => id !== teamId)
              : [...current, teamId],
          };
        }),
    }),
    {
      name: "shronk-calendar-storage",
      partialize: (state) => ({
        viewType: state.viewType,
        visibleTeamIds: state.visibleTeamIds,
      }),
    }
  )
);
