const STATUS_LABELS: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

const PRIORITY_LABELS: Record<string, string> = {
  none: "None",
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export function describeUpdate(
  updates: Record<string, unknown>,
  featureTitle?: string
): string {
  const name = featureTitle ? `"${featureTitle}"` : "Feature";

  if ("status" in updates) {
    const label = STATUS_LABELS[updates.status as string] ?? updates.status;
    return `${name} status changed to ${label}`;
  }
  if ("priority" in updates) {
    const label =
      PRIORITY_LABELS[updates.priority as string] ?? updates.priority;
    return `${name} priority changed to ${label}`;
  }
  if ("duration" in updates) {
    return `${name} duration changed to ${updates.duration}d`;
  }
  if ("title" in updates) {
    return `${name} renamed`;
  }
  if ("startDate" in updates || "endDate" in updates) {
    return `${name} dates updated`;
  }
  if ("progress" in updates) {
    return `${name} progress updated`;
  }
  return `${name} updated`;
}
