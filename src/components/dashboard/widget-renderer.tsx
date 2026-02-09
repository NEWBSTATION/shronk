"use client";

import type { Milestone, MilestoneDependency, Team } from "@/db/schema";
import type { WidgetConfig, GlobalFilters } from "@/types/dashboard";
import { WidgetWrapper } from "./widget-wrapper";
import { StatWidget } from "./widgets/stat-widget";
import { ProgressWidget } from "./widgets/progress-widget";
import { ChartWidget } from "./widgets/chart-widget";
import { ActivityWidget } from "./widgets/activity-widget";

export interface WidgetProps {
  config: WidgetConfig;
  milestones: Milestone[];
  dependencies: MilestoneDependency[];
  teams: Team[];
  globalFilters: GlobalFilters;
  isEditMode: boolean;
}

const WIDGET_COMPONENTS: Record<
  string,
  React.ComponentType<WidgetProps>
> = {
  stat: StatWidget,
  progress: ProgressWidget,
  chart: ChartWidget,
  activity: ActivityWidget,
};

interface WidgetRendererProps extends WidgetProps {
  onSettings?: (config: WidgetConfig) => void;
  onDelete?: (id: string) => void;
}

export function WidgetRenderer({
  config,
  onSettings,
  onDelete,
  ...rest
}: WidgetRendererProps) {
  const Component = WIDGET_COMPONENTS[config.type];

  if (!Component) {
    return (
      <WidgetWrapper config={config} isEditMode={rest.isEditMode} onSettings={onSettings} onDelete={onDelete}>
        <p className="text-sm text-muted-foreground">Unknown widget type: {config.type}</p>
      </WidgetWrapper>
    );
  }

  return (
    <WidgetWrapper config={config} isEditMode={rest.isEditMode} onSettings={onSettings} onDelete={onDelete}>
      <Component config={config} {...rest} />
    </WidgetWrapper>
  );
}
