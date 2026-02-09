"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  getStatusColor,
  getPriorityColor,
  statusConfig,
  priorityConfig,
} from "@/components/shared/status-badge";
import type { WidgetProps } from "../widget-renderer";
import { filterMilestones } from "../widget-data-utils";
import type { MilestoneStatus, MilestonePriority } from "@/db/schema";

export function ChartWidget({
  config,
  milestones,
  teams,
  globalFilters,
}: WidgetProps) {
  const chartType = config.settings.chartType || "bar";
  const dimension = config.settings.dataDimension || "status";
  const showLegend = config.settings.showLegend !== false;

  const filtered = useMemo(
    () => filterMilestones(milestones, globalFilters, config.settings.filters),
    [milestones, globalFilters, config.settings.filters]
  );

  const { data, chartConfig, colors } = useMemo(() => {
    switch (dimension) {
      case "status": {
        const counts: Record<string, number> = {};
        filtered.forEach((m) => {
          counts[m.status] = (counts[m.status] || 0) + 1;
        });
        const entries = Object.entries(statusConfig);
        const d = entries
          .map(([key, cfg]) => ({
            name: cfg.label,
            key,
            value: counts[key] || 0,
            fill: getStatusColor(key as MilestoneStatus),
          }))
          .filter((item) => item.value > 0);
        const cc: ChartConfig = {};
        d.forEach((item) => {
          cc[item.key] = { label: item.name, color: item.fill };
        });
        return { data: d, chartConfig: cc, colors: d.map((i) => i.fill) };
      }
      case "priority": {
        const counts: Record<string, number> = {};
        filtered.forEach((m) => {
          counts[m.priority] = (counts[m.priority] || 0) + 1;
        });
        const entries = Object.entries(priorityConfig);
        const d = entries
          .map(([key, cfg]) => ({
            name: cfg.label,
            key,
            value: counts[key] || 0,
            fill: getPriorityColor(key as MilestonePriority),
          }))
          .filter((item) => item.value > 0);
        const cc: ChartConfig = {};
        d.forEach((item) => {
          cc[item.key] = { label: item.name, color: item.fill };
        });
        return { data: d, chartConfig: cc, colors: d.map((i) => i.fill) };
      }
      case "team": {
        const counts: Record<string, number> = {};
        filtered.forEach((m) => {
          const key = m.teamId || "unassigned";
          counts[key] = (counts[key] || 0) + 1;
        });
        const teamMap = new Map(teams.map((t) => [t.id, t]));
        const d = Object.entries(counts).map(([key, value]) => {
          const team = teamMap.get(key);
          return {
            name: team?.name || "Unassigned",
            key,
            value,
            fill: team?.color || "hsl(var(--muted))",
          };
        });
        const cc: ChartConfig = {};
        d.forEach((item) => {
          cc[item.key] = { label: item.name, color: item.fill };
        });
        return { data: d, chartConfig: cc, colors: d.map((i) => i.fill) };
      }
      default:
        return { data: [], chartConfig: {} as ChartConfig, colors: [] as string[] };
    }
  }, [dimension, filtered, teams]);

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No data to display
      </p>
    );
  }

  if (chartType === "pie" || chartType === "donut") {
    return (
      <ChartContainer config={chartConfig} className="h-full w-full">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={chartType === "donut" ? "40%" : 0}
            outerRadius="80%"
          >
            {data.map((entry, index) => (
              <Cell key={entry.key} fill={colors[index]} />
            ))}
          </Pie>
          <ChartTooltip content={<ChartTooltipContent />} />
          {showLegend && <Legend />}
        </PieChart>
      </ChartContainer>
    );
  }

  // Default: bar chart
  return (
    <ChartContainer config={chartConfig} className="h-full w-full">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={entry.key} fill={colors[index]} />
          ))}
        </Bar>
        {showLegend && <Legend />}
      </BarChart>
    </ChartContainer>
  );
}
