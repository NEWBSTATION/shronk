import type { LucideIcon } from "lucide-react";

export type WidgetType = "stat" | "chart" | "progress" | "activity";

export interface WidgetLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WidgetSettings {
  title?: string;
  dataSource?: string;
  filters?: WidgetFilters;
  display?: Record<string, unknown>;
  // Stat-specific
  metric?: string;
  // Chart-specific
  chartType?: "bar" | "pie" | "donut";
  dataDimension?: "status" | "priority" | "team";
  showLegend?: boolean;
  // Activity-specific
  itemLimit?: number;
}

export interface WidgetFilters {
  status?: string[];
  priority?: string[];
  teamId?: string[];
  dateRange?: { from?: string; to?: string };
}

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  layout: WidgetLayout;
  settings: WidgetSettings;
}

export interface GlobalFilters {
  status: string[];
  priority: string[];
  teamId: string[];
  dateRange?: { from?: string; to?: string };
}

export interface WidgetDefinition {
  type: WidgetType;
  label: string;
  description: string;
  icon: LucideIcon;
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
  maxSize: { w: number; h: number };
  defaultSettings: WidgetSettings;
}

/** A pre-configured template shown in the widget picker */
export interface WidgetPickerItem {
  key: string;
  type: WidgetType;
  label: string;
  description: string;
  icon: LucideIcon;
  defaultSize: { w: number; h: number };
  defaultSettings: WidgetSettings;
}
