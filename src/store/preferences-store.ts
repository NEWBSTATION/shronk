import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ToastPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

interface PreferencesStore {
  timezone: string;
  setTimezone: (timezone: string) => void;
  toastPosition: ToastPosition;
  setToastPosition: (position: ToastPosition) => void;
}

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set) => ({
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      setTimezone: (timezone: string) => set({ timezone }),
      toastPosition: "bottom-right",
      setToastPosition: (toastPosition: ToastPosition) => set({ toastPosition }),
    }),
    {
      name: "shronk-preferences-storage",
    }
  )
);
