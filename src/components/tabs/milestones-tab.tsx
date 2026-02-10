"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MilestoneOverview } from "@/components/milestone";
import { MilestoneDialog } from "@/components/milestone/milestone-dialog";
import { MilestoneDetailPanel } from "@/components/drilldown/panels/milestone-detail-panel";
import { useDrilldown } from "@/components/drilldown/drilldown-context";
import { useProjects, useMilestoneStats } from "@/hooks/use-milestones";

export function MilestonesTab({ createIntent = 0 }: { createIntent?: number }) {
  const { push } = useDrilldown();
  const { data: projectsData, isLoading } = useProjects();
  const projects = projectsData?.projects ?? [];
  const { data: statsData } = useMilestoneStats();
  const stats = statsData?.stats || [];

  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);

  // React to create intent from the header plus button
  const prevIntent = useRef(createIntent);
  useEffect(() => {
    if (createIntent > 0 && createIntent !== prevIntent.current) {
      prevIntent.current = createIntent;
      setMilestoneDialogOpen(true);
    }
  }, [createIntent]);

  const handleSelectMilestone = useCallback(
    (milestoneId: string) => {
      const milestone = projects.find((p) => p.id === milestoneId);
      if (milestone) {
        push(
          `milestone-${milestoneId}`,
          <MilestoneDetailPanel milestone={milestone} />
        );
      }
    },
    [projects, push]
  );

  if (isLoading) {
    return (
      <div className="flex flex-col flex-1 min-h-0 px-6 py-8 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-7 w-32 rounded-md" />
          </div>
          {/* Table header */}
          <div className="flex items-center gap-4 py-3 border-b">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20 ml-auto" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-14" />
          </div>
          {/* Table rows */}
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-3.5 border-b border-border/50">
              <div className="flex items-center gap-2 flex-1">
                <Skeleton className="h-2 w-2 rounded-full" />
                <Skeleton className="h-4 w-40" />
              </div>
              <Skeleton className="h-4 w-28" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-1.5 w-16 rounded-full" />
                <Skeleton className="h-3 w-8" />
              </div>
              <Skeleton className="h-4 w-14" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 px-6 py-8 overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-base font-medium">Milestones</h1>
          <Button
            onClick={() => setMilestoneDialogOpen(true)}
            className="h-7 text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Milestone
          </Button>
        </div>

        <MilestoneOverview
          milestones={projects}
          stats={stats}
          onSelectMilestone={handleSelectMilestone}
          onCreateMilestone={() => setMilestoneDialogOpen(true)}
        />
      </div>

      <MilestoneDialog
        open={milestoneDialogOpen}
        onOpenChange={setMilestoneDialogOpen}
      />
    </div>
  );
}
