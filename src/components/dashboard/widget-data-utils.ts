import type { Milestone, MilestoneDependency } from "@/db/schema";
import type { GlobalFilters, WidgetFilters } from "@/types/dashboard";

const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 } as const;

export function mergeFilters(
  global: GlobalFilters,
  perWidget?: WidgetFilters
): WidgetFilters {
  if (!perWidget) return global;
  return {
    status: perWidget.status?.length ? perWidget.status : global.status,
    priority: perWidget.priority?.length ? perWidget.priority : global.priority,
    teamId: perWidget.teamId?.length ? perWidget.teamId : global.teamId,
    dateRange: perWidget.dateRange ?? global.dateRange,
  };
}

export function filterMilestones(
  milestones: Milestone[],
  globalFilters: GlobalFilters,
  widgetFilters?: WidgetFilters
): Milestone[] {
  const filters = mergeFilters(globalFilters, widgetFilters);
  let result = milestones;

  if (filters.status?.length) {
    result = result.filter((m) => filters.status!.includes(m.status));
  }
  if (filters.priority?.length) {
    result = result.filter((m) => filters.priority!.includes(m.priority));
  }
  if (filters.teamId?.length) {
    result = result.filter((m) => {
      if (filters.teamId!.includes("none") && !m.teamId) return true;
      return m.teamId ? filters.teamId!.includes(m.teamId) : false;
    });
  }
  if (filters.dateRange?.from) {
    const from = new Date(filters.dateRange.from);
    result = result.filter((m) => new Date(m.endDate) >= from);
  }
  if (filters.dateRange?.to) {
    const to = new Date(filters.dateRange.to);
    result = result.filter((m) => new Date(m.startDate) <= to);
  }

  return result;
}

export function getUpNextFeatures(
  milestones: Milestone[],
  dependencies: MilestoneDependency[]
): Milestone[] {
  const completedIds = new Set(
    milestones.filter((m) => m.status === "completed").map((m) => m.id)
  );
  const blockedIds = new Set<string>();
  for (const dep of dependencies) {
    if (!completedIds.has(dep.predecessorId)) {
      blockedIds.add(dep.successorId);
    }
  }
  return milestones
    .filter((m) => m.status === "not_started" && !blockedIds.has(m.id))
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

export function sortByPriority(items: Milestone[]): Milestone[] {
  return [...items].sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  );
}

export function sortByUpdated(items: Milestone[]): Milestone[] {
  return [...items].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function sortByCompleted(items: Milestone[]): Milestone[] {
  return [...items].sort((a, b) => {
    const aDate = a.completedAt ?? a.updatedAt;
    const bDate = b.completedAt ?? b.updatedAt;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });
}
