"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import {
  Gem,
  Users,
  TrendingUp,
  ChevronDown,
  Check,
  Minus,
  Plus,
  Calendar,
} from "lucide-react";
import { format, isBefore, startOfDay, differenceInDays, addDays, eachWeekOfInterval, isAfter } from "date-fns";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/format-duration";
import {
  useProjects,
  useMilestones,
  useTeams,
  useDependencies,
  useUpdateMilestone,
  useDeleteMilestone,
} from "@/hooks/use-milestones";
import { useDrilldown } from "@/components/drilldown/drilldown-context";
import { FeatureDetailPanel } from "@/components/drilldown/panels/feature-detail-panel";
import { FeatureDialog } from "@/components/feature/feature-dialog";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type {
  Milestone,
  Team,
  TeamMilestoneDuration,
} from "@/db/schema";

// ─── Derived Types ───────────────────────────────────────────────────────────

interface ComputedFeature {
  id: string;
  title: string;
  projectId: string;
  startDate: Date;
  endDate: Date;
  baseDuration: number;
  effectiveDuration: number;
  longestTrackTeam: string | null;
  status: "completed" | "in_progress" | "overdue" | "not_started" | "on_hold" | "cancelled";
  rawStatus: Milestone["status"];
  priority: Milestone["priority"];
  progress: number;
  daysUntilDue: number;
  teamDurations: Array<{ teamId: string; teamName: string; teamColor: string; duration: number }>;
}

interface TeamTimeline {
  id: string;
  name: string;
  color: string;
  startDate: Date | null;
  endDate: Date | null;
  spanDays: number;
  totalDuration: number;
  assignedFeatures: Array<{
    id: string;
    title: string;
    status: ComputedFeature["status"];
    duration: number;
    startDate: Date;
    endDate: Date;
  }>;
  unassignedFeatures: Array<{
    id: string;
    title: string;
    status: ComputedFeature["status"];
  }>;
}

// ─── Computations ────────────────────────────────────────────────────────────

function computeFeatures(
  milestones: Milestone[],
  teamDurations: TeamMilestoneDuration[],
  teams: Team[]
): ComputedFeature[] {
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const today = startOfDay(new Date());

  const durationsByMilestone = new Map<string, TeamMilestoneDuration[]>();
  for (const td of teamDurations) {
    const arr = durationsByMilestone.get(td.milestoneId) ?? [];
    arr.push(td);
    durationsByMilestone.set(td.milestoneId, arr);
  }

  return milestones.map((m) => {
    const mTeamDurations = durationsByMilestone.get(m.id) ?? [];
    const resolvedTeamDurations = mTeamDurations
      .map((td) => {
        const team = teamMap.get(td.teamId);
        return team
          ? { teamId: td.teamId, teamName: team.name, teamColor: team.color, duration: td.duration }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    let effectiveDuration = m.duration;
    let longestTrackTeam: string | null = null;
    if (resolvedTeamDurations.length > 0) {
      const maxTrack = resolvedTeamDurations.reduce((best, t) =>
        t.duration > best.duration ? t : best
      );
      effectiveDuration = maxTrack.duration;
      longestTrackTeam = maxTrack.teamName;
    }

    const endDate = startOfDay(new Date(m.endDate));
    let status: ComputedFeature["status"] = m.status;
    if (m.status !== "completed" && m.status !== "cancelled" && isBefore(endDate, today)) {
      status = "overdue";
    }

    return {
      id: m.id,
      title: m.title,
      projectId: m.projectId,
      startDate: new Date(m.startDate),
      endDate: new Date(m.endDate),
      baseDuration: m.duration,
      effectiveDuration,
      longestTrackTeam,
      status,
      rawStatus: m.status,
      priority: m.priority,
      progress: m.progress,
      daysUntilDue: differenceInDays(endDate, today),
      teamDurations: resolvedTeamDurations,
    };
  });
}

function useComputedDashboard(
  milestones: Milestone[],
  teamDurations: TeamMilestoneDuration[],
  teams: Team[]
) {
  return useMemo(() => {
    const computed = computeFeatures(milestones, teamDurations, teams);
    const total = computed.length;
    const completed = computed.filter((f) => f.rawStatus === "completed").length;
    const overdue = computed.filter((f) => f.status === "overdue").length;
    const inProgress = computed.filter((f) => f.rawStatus === "in_progress").length;
    const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;
    const avgDuration =
      total > 0
        ? Math.round(computed.reduce((sum, f) => sum + f.effectiveDuration, 0) / total)
        : 0;

    // Bottleneck team
    const bottleneckCounts = new Map<string, number>();
    for (const f of computed) {
      if (f.longestTrackTeam) {
        bottleneckCounts.set(f.longestTrackTeam, (bottleneckCounts.get(f.longestTrackTeam) ?? 0) + 1);
      }
    }
    let bottleneckTeam = "";
    let bottleneckMax = 0;
    for (const [team, count] of bottleneckCounts) {
      if (count > bottleneckMax) { bottleneckMax = count; bottleneckTeam = team; }
    }

    // Team duration chart data
    const teamDurationSums = new Map<string, { name: string; color: string; days: number }>();
    for (const f of computed) {
      for (const td of f.teamDurations) {
        const existing = teamDurationSums.get(td.teamId);
        if (existing) { existing.days += td.duration; }
        else { teamDurationSums.set(td.teamId, { name: td.teamName, color: td.teamColor, days: td.duration }); }
      }
    }
    const durationByTeam = Array.from(teamDurationSums.values()).sort((a, b) => b.days - a.days);

    // Critical path chart data
    const criticalCounts = new Map<string, { name: string; color: string; count: number }>();
    for (const f of computed) {
      if (f.teamDurations.length === 0) continue;
      const maxDur = Math.max(...f.teamDurations.map((td) => td.duration));
      for (const td of f.teamDurations) {
        if (td.duration === maxDur) {
          const existing = criticalCounts.get(td.teamId);
          if (existing) { existing.count += 1; }
          else { criticalCounts.set(td.teamId, { name: td.teamName, color: td.teamColor, count: 1 }); }
        }
      }
    }
    const criticalByTeam = Array.from(criticalCounts.values()).sort((a, b) => b.count - a.count);

    // Team timelines — per team: start/end dates, span, assigned & unassigned features
    const tdByTeamAndMilestone = new Map<string, Map<string, TeamMilestoneDuration>>();
    for (const td of teamDurations) {
      let teamEntries = tdByTeamAndMilestone.get(td.teamId);
      if (!teamEntries) {
        teamEntries = new Map();
        tdByTeamAndMilestone.set(td.teamId, teamEntries);
      }
      teamEntries.set(td.milestoneId, td);
    }

    const teamTimelines: TeamTimeline[] = teams.map((t) => {
      const teamEntries = tdByTeamAndMilestone.get(t.id);
      const assignedFeatures: TeamTimeline["assignedFeatures"] = [];
      const unassignedFeatures: TeamTimeline["unassignedFeatures"] = [];
      let earliest: Date | null = null;
      let latest: Date | null = null;
      let totalDuration = 0;

      for (const f of computed) {
        const entry = teamEntries?.get(f.id);
        if (entry) {
          const entryStart = new Date(entry.startDate);
          const entryEnd = new Date(entry.endDate);
          assignedFeatures.push({
            id: f.id,
            title: f.title,
            status: f.status,
            duration: entry.duration,
            startDate: entryStart,
            endDate: entryEnd,
          });
          totalDuration += entry.duration;
          if (!earliest || entryStart < earliest) earliest = entryStart;
          if (!latest || entryEnd > latest) latest = entryEnd;
        } else {
          unassignedFeatures.push({
            id: f.id,
            title: f.title,
            status: f.status,
          });
        }
      }

      const spanDays = earliest && latest
        ? differenceInDays(latest, earliest) + 1
        : 0;

      return {
        id: t.id,
        name: t.name,
        color: t.color,
        startDate: earliest,
        endDate: latest,
        spanDays,
        totalDuration,
        assignedFeatures,
        unassignedFeatures,
      };
    }).filter((t) => t.assignedFeatures.length > 0 || t.unassignedFeatures.length > 0);

    // Upcoming features (not completed/cancelled, sorted by endDate, nearest first)
    const upcoming = computed
      .filter((f) => f.rawStatus !== "completed" && f.rawStatus !== "cancelled")
      .sort((a, b) => a.endDate.getTime() - b.endDate.getTime())
      .slice(0, 6);

    const hasTeamData = teamDurations.length > 0;

    // Milestone date range — earliest feature start to latest feature end
    let milestoneStart: Date | null = null;
    let milestoneEnd: Date | null = null;
    for (const f of computed) {
      if (!milestoneStart || f.startDate < milestoneStart) milestoneStart = f.startDate;
      if (!milestoneEnd || f.endDate > milestoneEnd) milestoneEnd = f.endDate;
    }
    const milestoneSpanDays = milestoneStart && milestoneEnd
      ? differenceInDays(milestoneEnd, milestoneStart) + 1
      : 0;

    // Burndown chart data
    const burndownData: Array<{ date: string; planned: number; actual: number }> = [];
    if (milestoneStart && milestoneEnd && total > 0) {
      const today = startOfDay(new Date());
      const chartEnd = isAfter(today, milestoneEnd) ? today : milestoneEnd;
      const weeks = eachWeekOfInterval(
        { start: milestoneStart, end: addDays(chartEnd, 6) },
        { weekStartsOn: 1 }
      );

      // Sort features by endDate for planned burndown
      const sortedByEnd = [...computed].sort(
        (a, b) => a.endDate.getTime() - b.endDate.getTime()
      );

      // For actual burndown: use completedAt if available, else endDate for completed features
      const completedFeatures = computed
        .filter((f) => f.rawStatus === "completed")
        .map((f) => {
          const ms = milestones.find((m) => m.id === f.id);
          const completedDate = ms?.completedAt
            ? startOfDay(new Date(ms.completedAt))
            : f.endDate;
          return { ...f, completedDate };
        })
        .sort((a, b) => a.completedDate.getTime() - b.completedDate.getTime());

      for (const weekDate of weeks) {
        const weekEnd = startOfDay(weekDate);
        const plannedDone = sortedByEnd.filter(
          (f) => !isAfter(startOfDay(f.endDate), weekEnd)
        ).length;
        const actualDone = completedFeatures.filter(
          (f) => !isAfter(f.completedDate, weekEnd)
        ).length;

        burndownData.push({
          date: format(weekEnd, "yyyy-MM-dd"),
          planned: total - plannedDone,
          actual: total - actualDone,
        });
      }
    }

    return {
      computed, total, completed, overdue, inProgress, completionPct, avgDuration,
      bottleneckTeam, durationByTeam, criticalByTeam, teamTimelines, upcoming, hasTeamData,
      milestoneStart, milestoneEnd, milestoneSpanDays, burndownData,
    };
  }, [milestones, teamDurations, teams]);
}

// ─── Chart Helpers ───────────────────────────────────────────────────────────

const CHART_COLORS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)",
];

function buildChartConfig(dataKey: string, label: string, items: Array<{ name: string }>): ChartConfig {
  const config: ChartConfig = { [dataKey]: { label } };
  items.forEach((item, i) => {
    config[item.name] = { label: item.name, color: CHART_COLORS[i % CHART_COLORS.length] };
  });
  return config;
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ComputedFeature["status"] }) {
  const map = {
    completed: { cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", label: "Completed" },
    overdue: { cls: "bg-red-500/15 text-red-600 dark:text-red-400", label: "Overdue" },
    in_progress: { cls: "bg-blue-500/15 text-blue-600 dark:text-blue-400", label: "In Progress" },
    not_started: { cls: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400", label: "Not Started" },
    on_hold: { cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400", label: "On Hold" },
    cancelled: { cls: "bg-zinc-500/15 text-zinc-500 dark:text-zinc-500", label: "Cancelled" },
  } as const;
  const { cls, label } = map[status];
  return <Badge className={cn(cls, "border-0 text-[11px]")}>{label}</Badge>;
}

function DueBadge({ daysUntilDue }: { daysUntilDue: number }) {
  if (daysUntilDue < 0) {
    return (
      <span className="text-[11px] font-medium text-red-500 tabular-nums">
        {Math.abs(daysUntilDue)}d overdue
      </span>
    );
  }
  if (daysUntilDue === 0) {
    return <span className="text-[11px] font-medium text-amber-500">Due today</span>;
  }
  if (daysUntilDue <= 7) {
    return (
      <span className="text-[11px] font-medium text-amber-500 tabular-nums">
        {daysUntilDue}d left
      </span>
    );
  }
  return (
    <span className="text-[11px] text-muted-foreground tabular-nums">
      {daysUntilDue}d left
    </span>
  );
}

function TeamDurationChart({ data }: { data: Array<{ name: string; color: string; days: number }> }) {
  if (data.length === 0) return null;
  const config = buildChartConfig("days", "Total Days", data);

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5">
      <h3 className="text-sm font-medium text-foreground mb-4">Total Track Duration by Team</h3>
      <ChartContainer config={config} className="h-[220px] w-full aspect-auto">
        <BarChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
          <defs>
            {data.map((d, i) => (
              <linearGradient key={d.name} id={`grad-dur-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={d.color || CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.9} />
                <stop offset="100%" stopColor={d.color || CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.4} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/40" />
          <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <YAxis tickLine={false} axisLine={false} allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={36} />
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <Bar dataKey="days" radius={[6, 6, 0, 0]} barSize={32}
            shape={(props: unknown) => {
              const { x, y, width, height, index } = props as { x: number; y: number; width: number; height: number; index: number };
              return <rect x={x} y={y} width={width} height={height} rx={6} ry={6} fill={`url(#grad-dur-${index})`} />;
            }}
          />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

function CriticalPathChart({ data }: { data: Array<{ name: string; color: string; count: number }> }) {
  if (data.length === 0) return null;
  const config = buildChartConfig("count", "Critical Path Count", data);

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5">
      <h3 className="text-sm font-medium text-foreground mb-1">Critical Path Count by Team</h3>
      <p className="text-xs text-muted-foreground mb-4">Times a team was the longest-running track</p>
      <ChartContainer config={config} className="h-[200px] w-full aspect-auto">
        <BarChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
          <defs>
            {data.map((d, i) => (
              <linearGradient key={d.name} id={`grad-cp-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={d.color || CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.9} />
                <stop offset="100%" stopColor={d.color || CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.4} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/40" />
          <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <YAxis tickLine={false} axisLine={false} allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={24} />
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={32}
            shape={(props: unknown) => {
              const { x, y, width, height, index } = props as { x: number; y: number; width: number; height: number; index: number };
              return <rect x={x} y={y} width={width} height={height} rx={6} ry={6} fill={`url(#grad-cp-${index})`} />;
            }}
          />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

const burndownConfig = {
  planned: {
    label: "Planned",
    color: "var(--chart-1)",
  },
  actual: {
    label: "Actual",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

function BurndownChart({ data }: { data: Array<{ date: string; planned: number; actual: number }> }) {
  const [timeRange, setTimeRange] = useState("all");

  const filteredData = useMemo(() => {
    if (timeRange === "all") return data;
    const now = new Date();
    let daysToSubtract = 0;
    if (timeRange === "4w") daysToSubtract = 28;
    else if (timeRange === "8w") daysToSubtract = 56;
    else if (timeRange === "3m") daysToSubtract = 90;
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - daysToSubtract);
    return data.filter((item) => new Date(item.date) >= cutoff);
  }, [data, timeRange]);

  if (filteredData.length < 2) return null;

  return (
    <div className="rounded-xl border border-border/50 bg-card pt-0 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border/50 px-5 py-4 sm:flex-row">
        <div className="grid flex-1 gap-1">
          <h3 className="text-sm font-medium text-foreground">Burndown</h3>
          <p className="text-xs text-muted-foreground">Features remaining over time</p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger
            className="hidden w-[140px] rounded-lg sm:ml-auto sm:flex"
            aria-label="Select time range"
          >
            <SelectValue placeholder="All time" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all" className="rounded-lg">All time</SelectItem>
            <SelectItem value="3m" className="rounded-lg">Last 3 months</SelectItem>
            <SelectItem value="8w" className="rounded-lg">Last 8 weeks</SelectItem>
            <SelectItem value="4w" className="rounded-lg">Last 4 weeks</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="px-2 pt-4 pb-1 sm:px-5 sm:pt-5">
        <ChartContainer config={burndownConfig} className="h-[240px] w-full aspect-auto">
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillPlanned" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-planned)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-planned)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="fillActual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-actual)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-actual)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                });
              }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              width={28}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });
                  }}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="planned"
              type="natural"
              fill="url(#fillPlanned)"
              stroke="var(--color-planned)"
              strokeWidth={2}
              strokeDasharray="6 3"
            />
            <Area
              dataKey="actual"
              type="natural"
              fill="url(#fillActual)"
              stroke="var(--color-actual)"
              strokeWidth={2}
            />
            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
      </div>
    </div>
  );
}

/* ─── Team Timelines ─────────────────────────────────────────────────────── */

function TeamTimelineCard({ team, totalFeatures, onFeatureClick }: { team: TeamTimeline; totalFeatures: number; onFeatureClick?: (featureId: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const assigned = team.assignedFeatures.length;
  const unassigned = team.unassignedFeatures.length;

  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-accent/30 transition-colors"
      >
        <div
          className="h-3 w-3 rounded-full shrink-0"
          style={{ backgroundColor: team.color }}
        />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold truncate">{team.name}</h4>

          {/* Stats row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground">
            {team.startDate && team.endDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(team.startDate, "MMM d")} — {format(team.endDate, "MMM d")}
              </span>
            )}
            <span className="tabular-nums">{team.totalDuration}d total</span>
            <span className="tabular-nums">
              {assigned}/{totalFeatures} features
            </span>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground shrink-0 transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border/50 px-5 py-3 space-y-3">
          {/* Assigned features */}
          {assigned > 0 && (
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Assigned ({assigned})
              </p>
              <div className="space-y-1">
                {team.assignedFeatures.map((f) => (
                  <div
                    key={f.id}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm bg-accent/20",
                      onFeatureClick && "cursor-pointer hover:bg-accent/40 transition-colors"
                    )}
                    onClick={(e) => {
                      if (onFeatureClick) {
                        e.stopPropagation();
                        onFeatureClick(f.id);
                      }
                    }}
                  >
                    <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                    <span className="flex-1 truncate">{f.title}</span>
                    <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                      {format(f.startDate, "MMM d")} — {format(f.endDate, "MMM d")}
                    </span>
                    <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                      {formatDuration(f.duration)}
                    </span>
                    <StatusBadge status={f.status} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unassigned features */}
          {unassigned > 0 && (
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Not assigned ({unassigned})
              </p>
              <div className="space-y-1">
                {team.unassignedFeatures.map((f) => (
                  <div
                    key={f.id}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground",
                      onFeatureClick && "cursor-pointer hover:bg-accent/30 transition-colors"
                    )}
                    onClick={(e) => {
                      if (onFeatureClick) {
                        e.stopPropagation();
                        onFeatureClick(f.id);
                      }
                    }}
                  >
                    <Minus className="h-3 w-3 shrink-0" />
                    <span className="flex-1 truncate">{f.title}</span>
                    <StatusBadge status={f.status} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TeamTimelinesPanel({ teams, totalFeatures, onFeatureClick }: { teams: TeamTimeline[]; totalFeatures: number; onFeatureClick?: (featureId: string) => void }) {
  if (teams.length === 0) return null;

  return (
    <section>
      <h2 className="text-sm font-medium text-foreground mb-4">Team Timelines</h2>
      <div className="space-y-3">
        {teams.map((t) => (
          <TeamTimelineCard key={t.id} team={t} totalFeatures={totalFeatures} onFeatureClick={onFeatureClick} />
        ))}
      </div>
    </section>
  );
}

function UpcomingPanel({ features, onFeatureClick }: { features: ComputedFeature[]; onFeatureClick?: (featureId: string) => void }) {
  if (features.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5">
      <h3 className="text-sm font-medium text-foreground mb-4">Upcoming Features</h3>
      <div className="space-y-1">
        {features.map((f) => (
          <div
            key={f.id}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 -mx-1 hover:bg-accent/30 transition-colors",
              onFeatureClick && "cursor-pointer"
            )}
            onClick={() => onFeatureClick?.(f.id)}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{f.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {format(f.endDate, "MMM d")}
                {f.longestTrackTeam && (
                  <>
                    <span className="mx-1.5 text-border">|</span>
                    {f.longestTrackTeam}
                  </>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <DueBadge daysUntilDue={f.daysUntilDue} />
              <StatusBadge status={f.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col flex-1 min-h-0 px-6 py-8">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <Skeleton className="h-9 w-48 rounded-md" />
        <div className="grid md:grid-cols-3 gap-3">
          <Skeleton className="h-[120px] rounded-xl" />
          <Skeleton className="h-[120px] rounded-xl" />
          <Skeleton className="h-[120px] rounded-xl" />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="h-[270px] rounded-xl" />
          <Skeleton className="h-[270px] rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────

export function DashboardTab() {
  const { data: projectsData, isLoading: isLoadingProjects } = useProjects();
  const projects = projectsData?.projects ?? [];

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [featureDialogOpen, setFeatureDialogOpen] = useState(false);

  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const { data: milestonesData, isLoading: isLoadingMilestones } = useMilestones({
    projectId: selectedProjectId || "",
    sortField: "sortOrder",
    sortDirection: "asc",
  });
  const milestones = useMemo(() => milestonesData?.milestones ?? [], [milestonesData?.milestones]);
  const teamDurations = useMemo(() => milestonesData?.teamDurations ?? [], [milestonesData?.teamDurations]);

  const { data: teamsData } = useTeams();
  const teams = useMemo(() => teamsData?.teams ?? [], [teamsData?.teams]);

  const {
    total, completed, overdue, inProgress, completionPct, avgDuration,
    bottleneckTeam, durationByTeam, criticalByTeam, teamTimelines, upcoming, hasTeamData,
    milestoneStart, milestoneEnd, milestoneSpanDays, burndownData,
  } = useComputedDashboard(milestones, teamDurations, teams);

  const { push } = useDrilldown();
  const queryClient = useQueryClient();
  const { data: depsData } = useDependencies(selectedProjectId || "");
  const dependencies = useMemo(() => depsData?.dependencies ?? [], [depsData?.dependencies]);
  const updateMutation = useUpdateMilestone();
  const deleteMutation = useDeleteMilestone();

  const handleUpdateFeature = useCallback(
    async (data: Partial<Milestone> & { id: string; duration?: number }) => {
      try {
        await updateMutation.mutateAsync(data);
        toast.success("Feature updated");
      } catch {
        toast.error("Failed to update feature");
      }
    },
    [updateMutation]
  );

  const handleDeleteFeature = useCallback(
    async (id: string) => {
      try {
        await deleteMutation.mutateAsync(id);
        toast.success("Feature deleted");
      } catch {
        toast.error("Failed to delete feature");
      }
    },
    [deleteMutation]
  );

  const handleFeatureClick = useCallback(
    (featureId: string) => {
      const feature = milestones.find((m) => m.id === featureId);
      if (!feature) return;
      const project = projects.find((p) => p.id === feature.projectId);
      push(
        `feature-${feature.id}`,
        <FeatureDetailPanel
          feature={feature}
          teams={teams}
          projectName={project?.name}
          dependencies={dependencies}
          teamDurations={teamDurations}
          onUpdate={handleUpdateFeature}
          onDelete={handleDeleteFeature}
        />
      );
    },
    [milestones, projects, teams, dependencies, teamDurations, push, handleUpdateFeature, handleDeleteFeature]
  );

  if (isLoadingProjects) return <DashboardSkeleton />;

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6 py-8">
        <TrendingUp className="h-16 w-16 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-semibold">No data yet</h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm">
          Create a project and add milestones to see your dashboard come alive.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 px-6 py-8 overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl space-y-8">
        {/* Milestone Header */}
        <div className="space-y-3">
          <Select value={selectedProjectId ?? undefined} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="w-fit text-sm font-medium">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {milestoneStart && milestoneEnd && (() => {
            const today = startOfDay(new Date());
            const totalDays = milestoneSpanDays;
            const elapsed = Math.max(0, differenceInDays(today, milestoneStart));
            const remaining = Math.max(0, differenceInDays(milestoneEnd, today));
            const pct = totalDays > 0 ? Math.min(100, Math.max(0, (elapsed / totalDays) * 100)) : 0;
            const isPast = isBefore(milestoneEnd, today);
            const isFuture = isAfter(milestoneStart, today);
            const startYear = milestoneStart.getFullYear();
            const endYear = milestoneEnd.getFullYear();
            const nowYear = today.getFullYear();
            const startFmt = startYear !== nowYear ? "MMM d, yyyy" : "MMM d";
            const endFmt = endYear !== startYear || endYear !== nowYear ? "MMM d, yyyy" : "MMM d";

            return (
              <div className="rounded-xl border border-border/50 bg-card px-5 py-4">
                {/* Top row: elapsed / label / remaining */}
                <div className="flex items-baseline justify-between mb-3">
                  <div>
                    <span className="text-lg font-semibold tabular-nums tracking-tight">
                      {isPast ? totalDays : elapsed}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">
                      {isPast ? "days" : "days in"}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground/70">
                    {isPast
                      ? "Completed"
                      : isFuture
                        ? `Starts in ${differenceInDays(milestoneStart, today)}d`
                        : `${Math.round(pct)}% elapsed`}
                  </span>
                  <div className="text-right">
                    <span className="text-lg font-semibold tabular-nums tracking-tight">
                      {isPast ? 0 : remaining}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">days left</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="relative h-1.5 bg-muted rounded-full overflow-visible">
                  <div
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
                      isPast
                        ? "bg-emerald-500"
                        : "bg-gradient-to-r from-[var(--chart-1)] to-[var(--chart-2)]"
                    )}
                    style={{ width: `${pct}%` }}
                  />
                  {!isPast && !isFuture && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-foreground border-2 border-background shadow-sm"
                      style={{ left: `${pct}%`, marginLeft: "-5px" }}
                    />
                  )}
                </div>

                {/* Bottom row: start date / end date */}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] text-muted-foreground">
                    {format(milestoneStart, startFmt)}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {format(milestoneEnd, endFmt)}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>

        {isLoadingMilestones ? (
          <div className="space-y-6">
            <div className="grid md:grid-cols-3 gap-3">
              <Skeleton className="h-[120px] rounded-xl" />
              <Skeleton className="h-[120px] rounded-xl" />
              <Skeleton className="h-[120px] rounded-xl" />
            </div>
          </div>
        ) : total === 0 ? (
          <div className="flex flex-col items-center justify-center h-[40vh] text-center">
            <Gem className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-base font-semibold">No features yet</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm">
              Add features to this milestone to see dashboard analytics.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setFeatureDialogOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Feature
            </Button>
          </div>
        ) : (
          <>
            {/* Hero Stats — single unified card */}
            <section className="rounded-xl border border-border/50 bg-card overflow-hidden">
              {/* Completion bar — flush to top edge */}
              <div
                className="h-0.5 bg-gradient-to-r from-[var(--chart-1)] to-[var(--chart-2)] transition-all duration-500"
                style={{ width: `${completionPct}%` }}
              />

              {/* Stats row */}
              <div className="flex flex-wrap items-center divide-x divide-border/50">
                {/* Completion */}
                <div className="flex-1 min-w-[140px] px-5 pt-3 pb-4">
                  <p className="text-2xl font-semibold tabular-nums tracking-tight">
                    {completed}<span className="text-sm text-muted-foreground font-normal">/{total}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">features completed</p>
                </div>

                {/* Percentage */}
                <div className="flex-1 min-w-[100px] px-5 pt-3 pb-4">
                  <p className="text-2xl font-semibold tabular-nums tracking-tight">{completionPct}%</p>
                  <p className="text-xs text-muted-foreground mt-0.5">complete</p>
                </div>

                {/* In Progress */}
                <div className="flex-1 min-w-[100px] px-5 pt-3 pb-4">
                  <p className="text-2xl font-semibold tabular-nums tracking-tight text-blue-500">{inProgress}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">in progress</p>
                </div>

                {/* Overdue */}
                <div className="flex-1 min-w-[100px] px-5 pt-3 pb-4">
                  <p className={cn("text-2xl font-semibold tabular-nums tracking-tight", overdue > 0 ? "text-red-500" : "text-muted-foreground")}>
                    {overdue}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">overdue</p>
                </div>

                {/* Status */}
                <div className="flex-1 min-w-[100px] px-5 pt-3 pb-4">
                  {completionPct === 100 ? (
                    <>
                      <div className="flex items-center gap-1.5">
                        <div className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                        <span className="text-base font-semibold text-emerald-600 dark:text-emerald-400">Done</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">all features shipped</p>
                    </>
                  ) : overdue > 0 ? (
                    <>
                      <p className="text-base font-semibold text-red-500">At Risk</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{overdue} overdue</p>
                    </>
                  ) : (
                    <>
                      <p className="text-base font-semibold text-blue-500">On Track</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{avgDuration}d avg duration</p>
                    </>
                  )}
                </div>

                {/* Bottleneck */}
                <div className="flex-1 min-w-[120px] px-5 pt-3 pb-4">
                  <p className="text-lg font-semibold tracking-tight truncate">{bottleneckTeam || "\u2014"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">bottleneck</p>
                </div>
              </div>
            </section>

            {/* Burndown Chart */}
            {burndownData.length >= 2 && (
              <BurndownChart data={burndownData} />
            )}

            {/* Team Timelines */}
            {hasTeamData ? (
              <TeamTimelinesPanel teams={teamTimelines} totalFeatures={total} onFeatureClick={handleFeatureClick} />
            ) : (
              <div className="rounded-xl border border-dashed border-border/50 bg-muted/30 p-6 text-center">
                <Users className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Add teams and per-team track durations to see team timelines.
                </p>
              </div>
            )}

            {/* Charts */}
            {hasTeamData && (
              <section>
                <h2 className="text-sm font-medium text-foreground mb-4">Team Analysis</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <TeamDurationChart data={durationByTeam} />
                  <CriticalPathChart data={criticalByTeam} />
                </div>
              </section>
            )}

            {/* Upcoming Features */}
            {upcoming.length > 0 && (
              <section className="pb-8">
                <UpcomingPanel features={upcoming} onFeatureClick={handleFeatureClick} />
              </section>
            )}
          </>
        )}
      </div>

      <FeatureDialog
        open={featureDialogOpen}
        onOpenChange={setFeatureDialogOpen}
        milestones={projects.map((p) => ({ id: p.id, name: p.name, color: p.color, icon: p.icon }))}
        defaultMilestoneId={selectedProjectId}
        teams={teams}
      />
    </div>
  );
}
