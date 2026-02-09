import type { WidgetConfig } from "@/types/dashboard";

export function generateDefaultLayout(): WidgetConfig[] {
  return [
    // Row 1: 4 stat cards
    {
      id: "default-stat-total",
      type: "stat",
      layout: { x: 0, y: 0, w: 3, h: 2 },
      settings: { title: "Total Features", metric: "total" },
    },
    {
      id: "default-stat-in-progress",
      type: "stat",
      layout: { x: 3, y: 0, w: 3, h: 2 },
      settings: { title: "In Progress", metric: "in_progress" },
    },
    {
      id: "default-stat-completed",
      type: "stat",
      layout: { x: 6, y: 0, w: 3, h: 2 },
      settings: { title: "Completed", metric: "completed" },
    },
    {
      id: "default-stat-up-next",
      type: "stat",
      layout: { x: 9, y: 0, w: 3, h: 2 },
      settings: { title: "Up Next", metric: "up_next" },
    },
    // Row 2: Status bar chart (left), Timeline (right)
    {
      id: "default-chart-status",
      type: "chart",
      layout: { x: 0, y: 2, w: 6, h: 5 },
      settings: {
        title: "Status Overview",
        chartType: "bar",
        dataDimension: "status",
        showLegend: true,
      },
    },
    {
      id: "default-timeline",
      type: "progress",
      layout: { x: 6, y: 2, w: 6, h: 4 },
      settings: { title: "Timeline" },
    },
    // Row 3: Priority donut (left), Activity feed (right)
    {
      id: "default-chart-priority",
      type: "chart",
      layout: { x: 0, y: 7, w: 6, h: 5 },
      settings: {
        title: "Priority Breakdown",
        chartType: "donut",
        dataDimension: "priority",
        showLegend: true,
      },
    },
    {
      id: "default-activity",
      type: "activity",
      layout: { x: 6, y: 6, w: 6, h: 5 },
      settings: { title: "Recent Activity", itemLimit: 10 },
    },
  ];
}
