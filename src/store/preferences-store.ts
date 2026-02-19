import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PreferencesStore {
  timezone: string;
  setTimezone: (timezone: string) => void;
}

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set) => ({
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      setTimezone: (timezone: string) => set({ timezone }),
    }),
    {
      name: "shronk-preferences-storage",
    }
  )
);
