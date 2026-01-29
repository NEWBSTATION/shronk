"use client";

import { useEffect, useState } from "react";
import { useThemeStore } from "@/store/theme-store";
import { applyThemeToDocument } from "@/lib/theme-utils";

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [mounted, setMounted] = useState(false);
  const { mode, getCurrentStyles, currentPresetKey, getResolvedMode } = useThemeStore();

  // Wait for client-side hydration before rendering
  useEffect(() => {
    setMounted(true);
  }, []);

  // Apply theme when mode or preset changes
  useEffect(() => {
    if (!mounted) return;
    const styles = getCurrentStyles();
    const resolvedMode = getResolvedMode();
    applyThemeToDocument(styles, resolvedMode);
  }, [mounted, mode, currentPresetKey, getCurrentStyles, getResolvedMode]);

  // Handle system preference changes when mode is "system"
  useEffect(() => {
    if (!mounted) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      // Re-apply theme when system preference changes and mode is "system"
      if (mode === "system") {
        const styles = getCurrentStyles();
        const resolvedMode = getResolvedMode();
        applyThemeToDocument(styles, resolvedMode);
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [mounted, mode, getCurrentStyles, getResolvedMode]);

  return <>{children}</>;
}
