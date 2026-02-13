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
