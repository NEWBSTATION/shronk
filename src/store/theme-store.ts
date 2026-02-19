import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ThemePreset, ThemeMode, ThemeStyleProps } from "@/types/theme";
import { themePresets, defaultPresetKey } from "@/config/theme-presets";

interface ThemeStore {
  currentPresetKey: string;
  mode: ThemeMode;
  presets: Record<string, ThemePreset>;
  setPreset: (presetKey: string) => void;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  randomPreset: () => void;
  getCurrentStyles: () => ThemeStyleProps;
  getPreset: (key: string) => ThemePreset | undefined;
  getResolvedMode: () => "light" | "dark";
}

// Helper to get system preference (only works on client)
function getSystemPreference(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      currentPresetKey: defaultPresetKey,
      mode: "system",
      presets: themePresets,

      setPreset: (presetKey: string) => {
        if (get().presets[presetKey]) {
          set({ currentPresetKey: presetKey });
        }
      },

      setMode: (mode: ThemeMode) => {
        set({ mode });
      },

      toggleMode: () => {
        set((state) => {
          // Cycle through: light -> dark -> system -> light
          if (state.mode === "light") return { mode: "dark" };
          if (state.mode === "dark") return { mode: "system" };
          return { mode: "light" };
        });
      },

      randomPreset: () => {
        const state = get();
        const keys = Object.keys(state.presets).filter((k) => k !== state.currentPresetKey);
        if (keys.length === 0) return;
        const pick = keys[Math.floor(Math.random() * keys.length)];
        set({ currentPresetKey: pick });
      },

      getResolvedMode: () => {
        const state = get();
        if (state.mode === "system") {
          return getSystemPreference();
        }
        return state.mode;
      },

      getCurrentStyles: () => {
        const state = get();
        const preset = state.presets[state.currentPresetKey];
        const resolvedMode = state.mode === "system" ? getSystemPreference() : state.mode;

        if (!preset) {
          return state.presets[defaultPresetKey].styles[resolvedMode];
        }

        const currentModeStyles = preset.styles[resolvedMode];
        const otherModeStyles = preset.styles[resolvedMode === "light" ? "dark" : "light"];

        // Font properties that should be inherited across modes if not specified
        const fontProps = ["font-sans", "font-serif", "font-mono"] as const;
        const mergedStyles = { ...currentModeStyles };

        // Inherit font properties from the other mode if not defined in current mode
        for (const prop of fontProps) {
          if (!mergedStyles[prop] && otherModeStyles[prop]) {
            mergedStyles[prop] = otherModeStyles[prop];
          }
        }

        return mergedStyles;
      },

      getPreset: (key: string) => {
        return get().presets[key];
      },
    }),
    {
      name: "shronk-theme-storage",
    }
  )
);
