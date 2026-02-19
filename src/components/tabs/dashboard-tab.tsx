"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import {
  ChevronDown,
  Gem,
  Users,
  TrendingUp,
  Check,
  Plus,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  ShieldAlert,
} from "lucide-react";
import {
  format,
  isBefore,
  startOfDay,
  differenceInDays,
  addDays,
  isAfter,
} from "date-fns";
import {
  PieChart,
  Pie,
  Cell,
  Label,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/format-duration";
import { MilestoneIcon } from "@/lib/milestone-icon";
import { getColorStyles } from "@/lib/milestone-theme";
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
import { MilestoneDialog } from "@/components/milestone/milestone-dialog";
import { toast } from "sonner";
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

// ─── Status Colors ───────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  completed: "var(--status-completed)",
  in_progress: "var(--status-in-progress)",
  not_started: "var(--status-not-started)",
  overdue: "var(--status-cancelled)",
  on_hold: "var(--status-on-hold)",
  cancelled: "var(--color-muted-foreground)",
};

const STATUS_LABELS: Record<string, string> = {
  completed: "Completed",
  in_progress: "In Progress",
  not_started: "Not Started",
  overdue: "Overdue",
  on_hold: "On Hold",
  cancelled: "Cancelled",
};

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
    const notStarted = computed.filter((f) => f.rawStatus === "not_started").length;
    const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;
    const avgDuration =
      total > 0
        ? Math.round(computed.reduce((sum, f) => sum + f.effectiveDuration, 0) / total)
        : 0;

    // Total effort days
    const totalEffortDays = computed.reduce((sum, f) => sum + f.effectiveDuration, 0);

    // Status distribution
    const statusCounts = new Map<string, number>();
    for (const f of computed) {
      statusCounts.set(f.status, (statusCounts.get(f.status) ?? 0) + 1);
    }
    const statusDistribution = Array.from(statusCounts.entries()).map(([status, count]) => ({
      status,
      label: STATUS_LABELS[status] ?? status,
      count,
      color: STATUS_COLORS[status] ?? "var(--muted-foreground)",
    }));

    // Health status
    let healthStatus: "on_track" | "at_risk" | "off_track" | "complete" | "not_started" = "not_started";
    if (total > 0) {
      if (completed === total) {
        healthStatus = "complete";
      } else if (notStarted === total) {
        healthStatus = "not_started";
      } else if (overdue > total * 0.3) {
        healthStatus = "off_track";
      } else if (overdue > 0) {
        healthStatus = "at_risk";
      } else {
        healthStatus = "on_track";
      }
    }

    // Bottleneck team (most critical-path features)
    const bottleneckCounts = new Map<string, number>();
    for (const f of computed) {
      if (f.longestTrackTeam) {
        bottleneckCounts.set(f.longestTrackTeam, (bottleneckCounts.get(f.longestTrackTeam) ?? 0) + 1);
      }
    }
    let bottleneckTeam = "";
    let bottleneckCount = 0;
    for (const [team, count] of bottleneckCounts) {
      if (count > bottleneckCount) { bottleneckCount = count; bottleneckTeam = team; }
    }

    // Team tracks — per-team summary across milestones
    const teamTrackMap = new Map<string, {
      name: string;
      color: string;
      totalDays: number;
      milestoneCount: number;
      featuresTotal: number;
      featuresCompleted: number;
      featuresInProgress: number;
      featuresOverdue: number;
    }>();

    const featuresByProject = new Map<string, ComputedFeature[]>();
    for (const f of computed) {
      const arr = featuresByProject.get(f.projectId) ?? [];
      arr.push(f);
      featuresByProject.set(f.projectId, arr);
    }

    for (const [, projectFeatures] of featuresByProject) {
      if (projectFeatures.length === 0) continue;
      const fTotal = projectFeatures.length;
      const fCompleted = projectFeatures.filter((f) => f.rawStatus === "completed").length;
      const fInProgress = projectFeatures.filter((f) => f.rawStatus === "in_progress").length;
      const fOverdue = projectFeatures.filter((f) => f.status === "overdue").length;

      for (const td of projectFeatures[0].teamDurations) {
        let entry = teamTrackMap.get(td.teamId);
        if (!entry) {
          entry = { name: td.teamName, color: td.teamColor, totalDays: 0, milestoneCount: 0, featuresTotal: 0, featuresCompleted: 0, featuresInProgress: 0, featuresOverdue: 0 };
          teamTrackMap.set(td.teamId, entry);
        }
        entry.totalDays += td.duration;
        entry.milestoneCount++;
        entry.featuresTotal += fTotal;
        entry.featuresCompleted += fCompleted;
        entry.featuresInProgress += fInProgress;
        entry.featuresOverdue += fOverdue;
      }
    }
    const teamTracks = Array.from(teamTrackMap.values()).sort((a, b) => b.totalDays - a.totalDays);

    // Risk summary
    const today = startOfDay(new Date());
    const overdueFeatures = computed.filter((f) => f.status === "overdue");
    const dueSoonFeatures = computed.filter(
      (f) => f.rawStatus !== "completed" && f.rawStatus !== "cancelled" && f.daysUntilDue >= 0 && f.daysUntilDue <= 7
    );
    const overdueByPriority = new Map<string, number>();
    for (const f of overdueFeatures) {
      overdueByPriority.set(f.priority, (overdueByPriority.get(f.priority) ?? 0) + 1);
    }
    const worstOverdueDays = overdueFeatures.length > 0
      ? Math.max(...overdueFeatures.map((f) => Math.abs(f.daysUntilDue)))
      : 0;
    const riskSummary = {
      overdueCount: overdue,
      dueSoonCount: dueSoonFeatures.length,
      overdueByPriority: Array.from(overdueByPriority.entries()).map(([p, c]) => ({ priority: p, count: c })),
      worstOverdueDays,
    };

    // Upcoming features — active features due from today onward, sorted nearest first
    const upcoming = computed
      .filter((f) => f.rawStatus !== "completed" && f.rawStatus !== "cancelled" && !isBefore(f.endDate, today))
      .sort((a, b) => a.endDate.getTime() - b.endDate.getTime())
      .slice(0, 8)
      .map((f) => {
        const daysOut = differenceInDays(f.endDate, today);
        let window: "7d" | "14d" | "30d" | "30d+" = "30d+";
        if (daysOut <= 7) window = "7d";
        else if (daysOut <= 14) window = "14d";
        else if (daysOut <= 30) window = "30d";
        return { id: f.id, title: f.title, startDate: f.startDate, endDate: f.endDate, status: f.status, daysOut, window, duration: f.effectiveDuration };
      });

    // Milestone date range
    let milestoneStart: Date | null = null;
    let milestoneEnd: Date | null = null;
    for (const f of computed) {
      if (!milestoneStart || f.startDate < milestoneStart) milestoneStart = f.startDate;
      if (!milestoneEnd || f.endDate > milestoneEnd) milestoneEnd = f.endDate;
    }
    const milestoneSpanDays = milestoneStart && milestoneEnd
      ? differenceInDays(milestoneEnd, milestoneStart) + 1
      : 0;

    const hasTeamData = teamDurations.length > 0;

    return {
      computed, total, completed, overdue, inProgress, notStarted, completionPct, avgDuration,
      totalEffortDays, statusDistribution, healthStatus,
      bottleneckTeam, bottleneckCount,
      teamTracks,
      riskSummary, upcoming,
      hasTeamData, milestoneStart, milestoneEnd, milestoneSpanDays,
    };
  }, [milestones, teamDurations, teams]);
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

const HEALTH_META: Record<string, { icon: typeof Check; label: string; colorClass: string }> = {
  on_track: { icon: CheckCircle2, label: "On Track", colorClass: "text-emerald-500" },
  at_risk: { icon: AlertTriangle, label: "At Risk", colorClass: "text-amber-500" },
  off_track: { icon: ShieldAlert, label: "Off Track", colorClass: "text-red-500" },
  complete: { icon: CheckCircle2, label: "Complete", colorClass: "text-emerald-500" },
  not_started: { icon: Circle, label: "Not Started", colorClass: "text-muted-foreground" },
};

function HealthBanner({
  healthStatus,
  completionPct,
  total,
  completed,
  inProgress,
  overdue,
  statusDistribution,
}: {
  healthStatus: string;
  completionPct: number;
  total: number;
  completed: number;
  inProgress: number;
  overdue: number;
  statusDistribution: Array<{ status: string; label: string; count: number; color: string }>;
}) {
  const meta = HEALTH_META[healthStatus] ?? HEALTH_META.not_started;
  const HealthIcon = meta.icon;

  // Build explanation
  let explanation = "";
  if (healthStatus === "complete") explanation = "All features shipped";
  else if (healthStatus === "not_started") explanation = "No features in progress yet";
  else if (healthStatus === "off_track") explanation = `${overdue} of ${total} features are overdue`;
  else if (healthStatus === "at_risk") explanation = `${overdue} feature${overdue !== 1 ? "s" : ""} overdue`;
  else explanation = `${inProgress} in progress, ${total - completed} remaining`;

  // Donut config
  const pieData = statusDistribution.filter((d) => d.count > 0);
  const donutConfig: ChartConfig = {};
  for (const d of pieData) {
    donutConfig[d.status] = { label: d.label, color: d.color };
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr_auto] divide-y md:divide-y-0 md:divide-x divide-border/50">
        {/* Left — Radial progress with gradients */}
        <div className="flex items-center justify-center p-5">
          <ChartContainer config={donutConfig} className="h-[120px] w-[120px] aspect-square">
            <PieChart>
              <defs>
                <linearGradient id="grad-track" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="var(--muted)" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="var(--muted)" stopOpacity={0.2} />
                </linearGradient>
                {pieData.map((d) => (
                  <linearGradient key={d.status} id={`grad-${d.status}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={d.color} stopOpacity={1} />
                    <stop offset="100%" stopColor={d.color} stopOpacity={0.5} />
                  </linearGradient>
                ))}
              </defs>
              <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="status" />} />
              {/* Background track ring */}
              <Pie
                data={[{ count: 1 }]}
                dataKey="count"
                innerRadius={38}
                outerRadius={52}
                strokeWidth={0}
                isAnimationActive={false}
              >
                <Cell fill="url(#grad-track)" />
              </Pie>
              <Pie
                data={pieData}
                dataKey="count"
                nameKey="status"
                innerRadius={38}
                outerRadius={52}
                strokeWidth={2}
                stroke="var(--card)"
              >
                {pieData.map((d) => (
                  <Cell key={d.status} fill={`url(#grad-${d.status})`} />
                ))}
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                      return (
                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                          <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-bold">
                            {completionPct}%
                          </tspan>
                        </text>
                      );
                    }
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>
        </div>

        {/* Center — Health verdict */}
        <div className="flex flex-col justify-center px-6 py-5">
          <div className="flex items-center gap-2">
            <HealthIcon className={cn("h-5 w-5", meta.colorClass)} />
            <span className={cn("text-xl font-semibold", meta.colorClass)}>{meta.label}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{explanation}</p>
        </div>

        {/* Right — Key numbers */}
        <div className="flex flex-row md:flex-col gap-4 md:gap-2 px-6 py-5 min-w-[160px]">
          <div>
            <span className="text-lg font-semibold tabular-nums">{completed}<span className="text-sm text-muted-foreground font-normal">/{total}</span></span>
            <p className="text-[11px] text-muted-foreground">completed</p>
          </div>
          <div>
            <span className="text-lg font-semibold tabular-nums text-blue-500">{inProgress}</span>
            <p className="text-[11px] text-muted-foreground">in progress</p>
          </div>
          <div>
            <span className={cn("text-lg font-semibold tabular-nums", overdue > 0 ? "text-red-500" : "text-muted-foreground")}>{overdue}</span>
            <p className="text-[11px] text-muted-foreground">overdue</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCards({
  milestoneSpanDays,
  milestoneStart,
  milestoneEnd,
  avgDuration,
  totalEffortDays,
  bottleneckTeam,
  bottleneckCount,
}: {
  milestoneSpanDays: number;
  milestoneStart: Date | null;
  milestoneEnd: Date | null;
  avgDuration: number;
  totalEffortDays: number;
  bottleneckTeam: string;
  bottleneckCount: number;
}) {
  const dateRange = milestoneStart && milestoneEnd
    ? `${format(milestoneStart, "MMM d")} \u2013 ${format(milestoneEnd, "MMM d")}`
    : "\u2014";

  const cards = [
    {
      icon: Calendar,
      value: formatDuration(milestoneSpanDays),
      label: "Timeline Span",
      sub: dateRange,
    },
    {
      icon: Clock,
      value: formatDuration(avgDuration),
      label: "Avg Duration",
      sub: "per feature",
    },
    {
      icon: Users,
      value: bottleneckTeam || "\u2014",
      label: "Bottleneck",
      sub: bottleneckTeam ? `${bottleneckCount} critical path features` : "no team data",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-border/50 bg-card px-4 py-4">
          <div className="flex items-center gap-2 mb-2">
            <c.icon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{c.label}</span>
          </div>
          <p className="text-lg font-semibold truncate">{c.value}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}

function TeamTracksCard({
  data,
}: {
  data: Array<{
    name: string;
    color: string;
    totalDays: number;
    milestoneCount: number;
    featuresTotal: number;
    featuresCompleted: number;
    featuresInProgress: number;
    featuresOverdue: number;
  }>;
}) {
  if (data.length === 0) return null;

  const maxDays = Math.max(...data.map((t) => t.totalDays), 1);

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5">
      <h3 className="text-sm font-medium text-foreground mb-1">Team Workload</h3>
      <p className="text-xs text-muted-foreground mb-5">Allocation and progress per team</p>
      <div className="space-y-3">
        {data.map((team) => {
          const progressPct = team.featuresTotal > 0
            ? Math.round((team.featuresCompleted / team.featuresTotal) * 100)
            : 0;
          const barWidth = Math.max((team.totalDays / maxDays) * 100, 8);

          return (
            <div key={team.name} className="group/track">
              {/* Label row */}
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium truncate">{team.name}</span>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {team.totalDays}d
                </span>
              </div>

              {/* Gradient bar with segmented progress */}
              <div className="relative h-7 rounded-lg overflow-hidden bg-muted/40">
                {/* Allocated bar — gradient from team color to transparent */}
                <div
                  className="absolute inset-y-0 left-0 rounded-lg transition-all duration-500"
                  style={{
                    width: `${barWidth}%`,
                    background: `linear-gradient(90deg, ${team.color}, color-mix(in srgb, ${team.color} 25%, transparent))`,
                    opacity: 0.15,
                  }}
                />

                {/* Completed segment — solid gradient */}
                <div
                  className="absolute inset-y-0 left-0 rounded-lg transition-all duration-500"
                  style={{
                    width: `${(progressPct / 100) * barWidth}%`,
                    background: `linear-gradient(90deg, ${team.color}, color-mix(in srgb, ${team.color} 60%, transparent))`,
                  }}
                />

                {/* Inner label */}
                <div className="absolute inset-0 flex items-center px-2.5">
                  <span className="text-[11px] font-medium tabular-nums" style={{
                    color: progressPct > 15 ? '#fff' : 'var(--foreground)',
                    textShadow: progressPct > 15 ? '0 0.5px 2px rgba(0,0,0,0.3)' : 'none',
                  }}>
                    {team.featuresCompleted}/{team.featuresTotal}
                  </span>
                  <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
                    {progressPct}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RiskSummaryCard({
  riskSummary,
}: {
  riskSummary: {
    overdueCount: number;
    dueSoonCount: number;
    overdueByPriority: Array<{ priority: string; count: number }>;
    worstOverdueDays: number;
  };
}) {
  const priorityColors: Record<string, string> = {
    critical: "bg-red-500/15 text-red-600 dark:text-red-400",
    high: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    medium: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    low: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400",
    none: "bg-zinc-500/10 text-zinc-500",
  };

  const hasRisk = riskSummary.overdueCount > 0 || riskSummary.dueSoonCount > 0;

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 flex flex-col">
      <h3 className="text-sm font-medium text-foreground mb-4">Risk Summary</h3>
      {hasRisk ? (
        <div className="space-y-4">
          {/* Overdue count */}
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold tabular-nums text-red-500">
              {riskSummary.overdueCount}
            </span>
            <span className="text-sm text-muted-foreground">overdue</span>
          </div>

          {/* Due within 7 days */}
          {riskSummary.dueSoonCount > 0 && (
            <div className="flex items-baseline gap-3">
              <span className="text-xl font-semibold tabular-nums text-amber-500">
                {riskSummary.dueSoonCount}
              </span>
              <span className="text-sm text-muted-foreground">due within 7 days</span>
            </div>
          )}

          {/* Priority breakdown */}
          {riskSummary.overdueByPriority.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {riskSummary.overdueByPriority.map((p) => (
                <Badge key={p.priority} className={cn(priorityColors[p.priority] ?? priorityColors.none, "border-0 text-[11px]")}>
                  {p.count} {p.priority}
                </Badge>
              ))}
            </div>
          )}

          {/* Worst overdue */}
          {riskSummary.worstOverdueDays > 0 && (
            <p className="text-xs text-muted-foreground">
              Worst: <span className="text-red-500 font-medium">{riskSummary.worstOverdueDays}d</span> overdue
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center flex-1 h-full min-h-[120px] text-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-500/60 mb-2" />
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">All clear</p>
          <p className="text-xs text-muted-foreground mt-0.5">No overdue or at-risk features</p>
        </div>
      )}
    </div>
  );
}

const WINDOW_LABELS: Record<string, string> = {
  "7d": "Next 7 days",
  "14d": "Next 14 days",
  "30d": "Next 30 days",
  "30d+": "Later",
};

function UpcomingCard({
  upcoming,
  onFeatureClick,
}: {
  upcoming: Array<{ id: string; title: string; startDate: Date; endDate: Date; status: string; daysOut: number; window: string; duration: number }>;
  onFeatureClick?: (featureId: string) => void;
}) {
  if (upcoming.length === 0) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-5">
        <h3 className="text-sm font-medium text-foreground mb-3">Upcoming</h3>
        <p className="text-sm text-muted-foreground">No upcoming features</p>
      </div>
    );
  }

  // Group by window
  const groups = new Map<string, typeof upcoming>();
  for (const f of upcoming) {
    const arr = groups.get(f.window) ?? [];
    arr.push(f);
    groups.set(f.window, arr);
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5">
      <h3 className="text-sm font-medium text-foreground mb-3">Upcoming</h3>
      <div className="space-y-4">
        {["7d", "14d", "30d", "30d+"].map((w) => {
          const items = groups.get(w);
          if (!items) return null;
          return (
            <div key={w}>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                {WINDOW_LABELS[w]}
              </p>
              <div className="space-y-1">
                {items.map((f) => (
                  <div
                    key={f.id}
                    className={cn(
                      "flex items-center gap-2 text-sm rounded-md px-2 py-1.5 -mx-2",
                      onFeatureClick && "cursor-pointer hover:bg-accent/40 transition-colors"
                    )}
                    onClick={() => onFeatureClick?.(f.id)}
                  >
                    <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[f.status] ?? "var(--muted-foreground)" }} />
                    <span className="flex-1 truncate">{f.title}</span>
                    <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                      {format(f.startDate, "MMM d")}
                    </span>
                    <Badge variant="secondary" className="text-[10px] tabular-nums px-1.5 py-0 shrink-0">
                      {formatDuration(f.duration)}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col flex-1 min-h-0 px-6 pt-8">
      <div className="mx-auto w-full max-w-xl lg:max-w-2xl xl:max-w-4xl space-y-6">
        {/* Project switcher */}
        <div className="rounded-xl border border-border/50 bg-card px-5 py-4 flex items-center gap-2.5">
          <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
          <Skeleton className="h-5 w-36" />
        </div>

        {/* Health banner */}
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-[200px_1fr_auto] divide-y md:divide-y-0 md:divide-x divide-border/50">
            <div className="flex items-center justify-center p-5">
              <Skeleton className="h-[120px] w-[120px] rounded-full" />
            </div>
            <div className="flex flex-col justify-center px-6 py-5 gap-2">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-4 w-48" />
            </div>
            <div className="flex flex-row md:flex-col gap-4 md:gap-3 px-6 py-5 min-w-[160px]">
              <div className="space-y-1">
                <Skeleton className="h-6 w-12" />
                <Skeleton className="h-3 w-16" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-6 w-8" />
                <Skeleton className="h-3 w-16" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-6 w-8" />
                <Skeleton className="h-3 w-14" />
              </div>
            </div>
          </div>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-border/50 bg-card px-4 py-4 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-3.5 w-3.5 rounded" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>

        {/* Risk + Upcoming */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-16" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
            <Skeleton className="h-4 w-20" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-1.5 w-1.5 rounded-full" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
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
  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);

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
    totalEffortDays, statusDistribution, healthStatus,
    bottleneckTeam, bottleneckCount,
    teamTracks,
    riskSummary, upcoming,
    hasTeamData, milestoneStart, milestoneEnd, milestoneSpanDays,
  } = useComputedDashboard(milestones, teamDurations, teams);

  const { push } = useDrilldown();
  const { data: depsData } = useDependencies(selectedProjectId || "");
  const dependencies = useMemo(() => depsData?.dependencies ?? [], [depsData?.dependencies]);
  const updateMutation = useUpdateMilestone();
  const deleteMutation = useDeleteMilestone();

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
          onUpdate={async (data) => {
            try { await updateMutation.mutateAsync(data); toast.success("Feature updated"); }
            catch { toast.error("Failed to update feature"); }
          }}
          onDelete={async (id) => {
            const f = milestones.find((m) => m.id === id);
            try { await deleteMutation.mutateAsync(id); toast.success("Feature deleted", { description: f?.title }); }
            catch { toast.error("Failed to delete feature"); }
          }}
        />
      );
    },
    [milestones, projects, teams, dependencies, teamDurations, push, updateMutation, deleteMutation]
  );

  if (isLoadingProjects) return <DashboardSkeleton />;

  if (projects.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6 py-8">
          <TrendingUp className="h-16 w-16 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">No data yet</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm">
            Create a milestone to see your dashboard come alive.
          </p>
          <Button className="mt-4" onClick={() => setMilestoneDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Create Milestone
          </Button>
        </div>
        <MilestoneDialog
          open={milestoneDialogOpen}
          onOpenChange={setMilestoneDialogOpen}
        />
      </>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 px-6 pt-8 overflow-y-auto">
      <div className="mx-auto w-full max-w-xl lg:max-w-2xl xl:max-w-4xl space-y-6">
        {/* Milestone Switcher */}
        {(() => {
          const activeProject = projects.find((p) => p.id === selectedProjectId);
          const activeStyles = activeProject ? getColorStyles(activeProject.color) : null;
          return (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="group relative w-full text-left rounded-xl border border-border/50 bg-card overflow-hidden cursor-pointer hover:border-border hover:shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:hover:shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-all"
                  style={activeStyles ? {
                    background: `linear-gradient(135deg, color-mix(in srgb, ${activeStyles.hex} 6%, var(--color-card)) 0%, var(--color-card) 60%)`,
                  } : undefined}
                >
                  <div className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-2.5">
                      {activeProject && activeStyles && (
                        <span
                          className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
                          style={{ backgroundColor: activeStyles.iconBg, color: activeStyles.hex }}
                        >
                          <MilestoneIcon name={activeProject.icon} className="h-4 w-4" />
                        </span>
                      )}
                      <span className="text-base font-semibold tracking-tight">
                        {activeProject?.name ?? "Select milestone"}
                      </span>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                  </div>

                </button>
              </PopoverTrigger>
              <PopoverContent className="p-1 w-[var(--radix-popover-trigger-width)]" align="start" sideOffset={8}>
                {projects.map((p) => {
                  const styles = getColorStyles(p.color);
                  const isActive = selectedProjectId === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProjectId(p.id)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                        isActive
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-accent/50"
                      )}
                    >
                      <span
                        className="flex h-5 w-5 items-center justify-center rounded-md shrink-0"
                        style={{ backgroundColor: styles.iconBg, color: styles.hex }}
                      >
                        <MilestoneIcon name={p.icon} className="h-3 w-3" />
                      </span>
                      <span className="truncate">{p.name}</span>
                      {isActive && <Check className="h-3.5 w-3.5 ml-auto shrink-0 text-muted-foreground" />}
                    </button>
                  );
                })}
              </PopoverContent>
            </Popover>
          );
        })()}

        {isLoadingMilestones ? (
          <div className="space-y-6">
            {/* Health banner skeleton */}
            <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-[200px_1fr_auto] divide-y md:divide-y-0 md:divide-x divide-border/50">
                <div className="flex items-center justify-center p-5">
                  <Skeleton className="h-[120px] w-[120px] rounded-full" />
                </div>
                <div className="flex flex-col justify-center px-6 py-5 gap-2">
                  <Skeleton className="h-6 w-28" />
                  <Skeleton className="h-4 w-48" />
                </div>
                <div className="flex flex-row md:flex-col gap-4 md:gap-3 px-6 py-5 min-w-[160px]">
                  <div className="space-y-1"><Skeleton className="h-6 w-12" /><Skeleton className="h-3 w-16" /></div>
                  <div className="space-y-1"><Skeleton className="h-6 w-8" /><Skeleton className="h-3 w-16" /></div>
                  <div className="space-y-1"><Skeleton className="h-6 w-8" /><Skeleton className="h-3 w-14" /></div>
                </div>
              </div>
            </div>
            {/* Metric cards skeleton */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-xl border border-border/50 bg-card px-4 py-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3.5 w-3.5 rounded" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            </div>
          </div>
        ) : total === 0 ? (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6 py-8">
            <Gem className="h-16 w-16 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No features yet</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm">
              Add features to this milestone to see dashboard analytics.
            </p>
            <Button
              className="mt-4"
              onClick={() => setFeatureDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Create Feature
            </Button>
          </div>
        ) : (
          <>
            {/* 1. Health Banner */}
            <HealthBanner
              healthStatus={healthStatus}
              completionPct={completionPct}
              total={total}
              completed={completed}
              inProgress={inProgress}
              overdue={overdue}
              statusDistribution={statusDistribution}
            />

            {/* 2. Metric Cards */}
            <MetricCards
              milestoneSpanDays={milestoneSpanDays}
              milestoneStart={milestoneStart}
              milestoneEnd={milestoneEnd}
              avgDuration={avgDuration}
              totalEffortDays={totalEffortDays}
              bottleneckTeam={bottleneckTeam}
              bottleneckCount={bottleneckCount}
            />

            {/* 3. Team Workload */}
            {hasTeamData ? (
              <TeamTracksCard data={teamTracks} />
            ) : (
              <div className="rounded-xl border border-dashed border-border/50 bg-muted/30 p-6 text-center">
                <Users className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Add teams and per-team track durations to see team workload.
                </p>
              </div>
            )}

            {/* 5. Risk & Upcoming */}
            <div className="grid md:grid-cols-2 gap-4">
              <RiskSummaryCard riskSummary={riskSummary} />
              <UpcomingCard upcoming={upcoming} onFeatureClick={handleFeatureClick} />
            </div>
          </>
        )}
        <div className="h-24" aria-hidden />
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
