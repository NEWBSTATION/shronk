export const MILESTONE_COLORS: Record<string, string> = {
  slate: "#64748b",
  red: "#ef4444",
  orange: "#f97316",
  amber: "#f59e0b",
  emerald: "#10b981",
  teal: "#14b8a6",
  cyan: "#06b6d4",
  blue: "#3b82f6",
  indigo: "#6366f1",
  violet: "#8b5cf6",
  pink: "#ec4899",
  rose: "#f43f5e",
};

export const MILESTONE_COLOR_KEYS = Object.keys(MILESTONE_COLORS);

export function getColorHex(key: string): string {
  return MILESTONE_COLORS[key] ?? MILESTONE_COLORS.blue;
}

export function getColorStyles(key: string) {
  const hex = getColorHex(key);
  return {
    hex,
    iconBg: `${hex}20`,
    gradient: `${hex}18`,
    ring: `${hex}40`,
  };
}
