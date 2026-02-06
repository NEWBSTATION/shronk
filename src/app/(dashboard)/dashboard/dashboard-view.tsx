"use client";

import { useState, useEffect, useMemo } from "react";
import { useProjects, useMilestones } from "@/hooks/use-milestones";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, PriorityBadge } from "@/components/shared/status-badge";
import {
  Layers,
  Play,
  CircleCheck,
  ArrowRight,
  Calendar,
  Clock,
  Target,
} from "lucide-react";
import { format, differenceInCalendarDays, formatDistanceToNow } from "date-fns";
import type { Milestone } from "@/db/schema";
import Link from "next/link";


const STORAGE_KEY = "dashboard-selected-project";
const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 } as const;

export function DashboardView() {
  const { data: projectsData, isLoading: projectsLoading } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEY) ?? "";
    }
    return "";
  });

  // Persist selection to localStorage
  useEffect(() => {
    if (selectedProjectId) {
      localStorage.setItem(STORAGE_KEY, selectedProjectId);
    }
  }, [selectedProjectId]);

  // Auto-select first project if none saved (or saved one no longer exists)
  useEffect(() => {
    if (!projectsData?.projects.length) return;
    const ids = new Set(projectsData.projects.map((p) => p.id));
    if (!selectedProjectId || !ids.has(selectedProjectId)) {
      setSelectedProjectId(projectsData.projects[0].id);
    }
  }, [projectsData, selectedProjectId]);

  const { data: milestonesData, isLoading: milestonesLoading } = useMilestones({
    projectId: selectedProjectId,
  });

  const milestones = milestonesData?.milestones ?? [];
  const dependencies = milestonesData?.dependencies ?? [];

  // Derived data
  const totalFeatures = milestones.length;

  const inProgressFeatures = useMemo(
    () =>
      milestones
        .filter((m) => m.status === "in_progress")
        .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]),
    [milestones]
  );

  const completedFeatures = useMemo(
    () =>
      milestones
        .filter((m) => m.status === "completed")
        .sort((a, b) => {
          const aDate = a.completedAt ?? a.updatedAt;
          const bDate = b.completedAt ?? b.updatedAt;
          return new Date(bDate).getTime() - new Date(aDate).getTime();
        }),
    [milestones]
  );

  const upNextFeatures = useMemo(() => {
    const completedIds = new Set(
      milestones.filter((m) => m.status === "completed").map((m) => m.id)
    );
    // Build set of features that have unfinished predecessors
    const blockedIds = new Set<string>();
    for (const dep of dependencies) {
      if (!completedIds.has(dep.predecessorId)) {
        blockedIds.add(dep.successorId);
      }
    }
    return milestones
      .filter((m) => m.status === "not_started" && !blockedIds.has(m.id))
      .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }, [milestones, dependencies]);

  const timeline = useMemo(() => {
    if (!milestones.length) return null;
    const starts = milestones.map((m) => new Date(m.startDate).getTime());
    const ends = milestones.map((m) => new Date(m.endDate).getTime());
    const earliest = new Date(Math.min(...starts));
    const latest = new Date(Math.max(...ends));
    const today = new Date();
    const totalDays = differenceInCalendarDays(latest, earliest) || 1;
    const elapsed = Math.max(0, differenceInCalendarDays(today, earliest));
    const remaining = Math.max(0, differenceInCalendarDays(latest, today));
    const percentComplete =
      totalFeatures > 0
        ? Math.round((completedFeatures.length / totalFeatures) * 100)
        : 0;
    const timeElapsedPercent = Math.min(
      100,
      Math.round((elapsed / totalDays) * 100)
    );
    return {
      earliest,
      latest,
      remaining,
      percentComplete,
      timeElapsedPercent,
      totalDays,
    };
  }, [milestones, totalFeatures, completedFeatures.length]);

  const isLoading = projectsLoading || (selectedProjectId && milestonesLoading);

  // No projects state
  if (!projectsLoading && (!projectsData?.projects.length)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Target className="h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-semibold">No milestones yet</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Create your first project and add milestones to get started.
        </p>
        <Link
          href="/dashboard/milestones"
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Go to Milestones
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Milestone Selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground">
          Project
        </label>
        {projectsLoading ? (
          <Skeleton className="h-9 w-[220px]" />
        ) : (
          <Select
            value={selectedProjectId}
            onValueChange={setSelectedProjectId}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Select a project" />
            </SelectTrigger>
            <SelectContent>
              {projectsData?.projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading ? (
        <DashboardSkeleton />
      ) : milestones.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Layers className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">No features yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Add features to this project to see them here.
          </p>
          <Link
            href="/dashboard/milestones"
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go to Milestones
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Features"
              value={totalFeatures}
              icon={Layers}
              description="In this project"
            />
            <StatCard
              title="In Progress"
              value={inProgressFeatures.length}
              icon={Play}
              description="Currently active"
            />
            <StatCard
              title="Completed"
              value={completedFeatures.length}
              icon={CircleCheck}
              description={
                totalFeatures > 0
                  ? `${Math.round((completedFeatures.length / totalFeatures) * 100)}% done`
                  : "No features"
              }
            />
            <StatCard
              title="Up Next"
              value={upNextFeatures.length}
              icon={ArrowRight}
              description="Ready to start"
            />
          </div>

          {/* Two Column Layout */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Left Column */}
            <div className="flex flex-col gap-4">
              {/* In Progress */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">In Progress</CardTitle>
                  <CardDescription>
                    Features currently being worked on
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {inProgressFeatures.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No features in progress
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {inProgressFeatures.map((f) => (
                        <FeatureRow key={f.id} feature={f} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Up Next */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Up Next</CardTitle>
                  <CardDescription>
                    Ready to start — all dependencies satisfied
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {upNextFeatures.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No features ready to start
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {upNextFeatures.slice(0, 5).map((f) => (
                        <FeatureRow key={f.id} feature={f} />
                      ))}
                      {upNextFeatures.length > 5 && (
                        <p className="text-xs text-muted-foreground text-center pt-1">
                          +{upNextFeatures.length - 5} more
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Column */}
            <div className="flex flex-col gap-4">
              {/* Timeline */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Timeline</CardTitle>
                  <CardDescription>
                    Project date range and progress
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {timeline ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          {format(timeline.earliest, "MMM d, yyyy")}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          {format(timeline.latest, "MMM d, yyyy")}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            Feature completion
                          </span>
                          <span className="font-medium">
                            {timeline.percentComplete}%
                          </span>
                        </div>
                        <Progress
                          value={timeline.percentComplete}
                          className="h-2"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            Time elapsed
                          </span>
                          <span className="font-medium">
                            {timeline.timeElapsedPercent}%
                          </span>
                        </div>
                        <Progress
                          value={timeline.timeElapsedPercent}
                          className="h-2"
                        />
                      </div>

                      <div className="flex items-center gap-1.5 text-sm">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {timeline.remaining > 0
                            ? `${timeline.remaining} days remaining`
                            : "Past deadline"}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No timeline data
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Recently Completed */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Recently Completed
                  </CardTitle>
                  <CardDescription>Last finished features</CardDescription>
                </CardHeader>
                <CardContent>
                  {completedFeatures.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No completed features yet
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {completedFeatures.slice(0, 5).map((f) => (
                        <div
                          key={f.id}
                          className="flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <CircleCheck className="h-3.5 w-3.5 shrink-0 text-green-500" fill="currentColor" />
                            <span className="text-sm truncate">
                              {f.title}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {formatDistanceToNow(
                              new Date(f.completedAt ?? f.updatedAt),
                              { addSuffix: true }
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  description,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  description: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function FeatureRow({ feature }: { feature: Milestone }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <PriorityBadge priority={feature.priority} showLabel={false} />
        <span className="text-sm truncate">{feature.title}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-muted-foreground">
          {feature.duration}d
        </span>
        <StatusBadge status={feature.status} />
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-12 mb-1" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-3 w-48" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-3 w-40" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-2 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
