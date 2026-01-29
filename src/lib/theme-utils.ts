import { ThemeStyleProps, ThemeMode } from "@/types/theme";

/**
 * GUARDRAIL: Theme Application Utilities
 *
 * These utilities apply tweakcn-compatible theme styles to the DOM.
 * The CSS variable names match shadcn/ui's expected contract.
 *
 * When creating new themes, ensure all variables are provided.
 */

// Default values for font variables (matches official tweakcn defaults)
const defaultFontValues: Record<string, string> = {
  "font-sans": "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'",
  "font-serif": "ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif",
  "font-mono": "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
};

// Color properties that need to be mapped to Tailwind's --color-* variables
const colorProps = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "border",
  "input",
  "ring",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "sidebar",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
];

export function applyThemeToDocument(styles: ThemeStyleProps, mode: ThemeMode) {
  const root = document.documentElement;

  // Update dark mode class
  if (mode === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  // Apply CSS variables
  Object.entries(styles).forEach(([key, value]) => {
    if (typeof value === "string") {
      root.style.setProperty(`--${key}`, value);

      // Also set the Tailwind --color-* variables directly for color properties
      // This ensures Tailwind utilities like bg-card work correctly
      if (colorProps.includes(key)) {
        root.style.setProperty(`--color-${key}`, value);
      }
    }
  });

  // Reset font variables to defaults if not specified by the theme
  Object.entries(defaultFontValues).forEach(([key, defaultValue]) => {
    if (!styles[key as keyof ThemeStyleProps]) {
      root.style.setProperty(`--${key}`, defaultValue);
    }
  });
}

export function generateCSSVariables(styles: ThemeStyleProps): string {
  return Object.entries(styles)
    .filter(([, value]) => typeof value === "string")
    .map(([key, value]) => `  --${key}: ${value};`)
    .join("\n");
}
