import type { DurationUnit } from "@/store/features-list-store";

/**
 * Formats a duration in days into a human-readable string.
 * - 30+ days → months (rounded to nearest 0.5)
 * - 7-29 days → weeks (rounded to nearest 0.5)
 * - <7 days → days
 */
export function formatDuration(days: number): string {
  if (days >= 30) {
    const months = Math.round((days / 30) * 2) / 2;
    return months === 1 ? "1 mo" : `${months} mo`;
  }
  if (days >= 7) {
    const weeks = Math.round((days / 7) * 2) / 2;
    return weeks === 1 ? "1 wk" : `${weeks} wks`;
  }
  return days === 1 ? "1d" : `${days}d`;
}

/**
 * Formats a duration in days into a specific unit.
 */
export function formatDurationIn(days: number, unit: DurationUnit): string {
  switch (unit) {
    case "weeks": {
      const weeks = Math.round((days / 7) * 10) / 10;
      return weeks === 1 ? "1 wk" : `${weeks} wks`;
    }
    case "months": {
      const months = Math.round((days / 30) * 10) / 10;
      return months === 1 ? "1 mo" : `${months} mo`;
    }
    case "years": {
      const years = Math.round((days / 365) * 10) / 10;
      return years === 1 ? "1 yr" : `${years} yrs`;
    }
    default:
      return days === 1 ? "1d" : `${days}d`;
  }
}
