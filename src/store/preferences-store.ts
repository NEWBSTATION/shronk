import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PreferencesStore {
  timezone: string;
  showDisplayName: boolean;
  setTimezone: (timezone: string) => void;
  setShowDisplayName: (show: boolean) => void;
}

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set) => ({
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      showDisplayName: false,
      setTimezone: (timezone: string) => set({ timezone }),
      setShowDisplayName: (show: boolean) => set({ showDisplayName: show }),
    }),
    {
      name: "shronk-preferences-storage",
    }
  )
);
