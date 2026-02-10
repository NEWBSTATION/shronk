"use client";

import { useState, useMemo, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { useTimelineStore } from "@/store/timeline-store";
import { ListTable } from "./list-table";
import { ListBulkActions } from "./list-bulk-actions";
import { useReorderMilestones } from "@/hooks/use-milestones";
import type { Milestone, Team, MilestoneDependency } from "@/db/schema";
import { statusConfig, priorityConfig } from "@/components/shared/status-badge";

interface ListViewProps {
  milestones: Milestone[];
  dependencies: MilestoneDependency[];
  teams: Team[];
  projectId: string;
  onEdit: (milestone: Milestone) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: Milestone["status"]) => void;
  onPriorityChange: (id: string, priority: Milestone["priority"]) => void;
  onBulkStatusChange: (ids: string[], status: Milestone["status"]) => void;
  onBulkPriorityChange: (ids: string[], priority: Milestone["priority"]) => void;
  onBulkDelete: (ids: string[]) => void;
  onBulkTeamChange: (ids: string[], teamId: string | null) => void;
}

interface GroupedMilestones {
  key: string;
  label: string;
  color?: string;
  milestones: Milestone[];
}

export function ListView({
  milestones,
  dependencies,
  teams,
  projectId,
  onEdit,
  onDelete,
  onStatusChange,
  onPriorityChange,
  onBulkStatusChange,
  onBulkPriorityChange,
  onBulkDelete,
  onBulkTeamChange,
}: ListViewProps) {
  const {
    groupBy,
    collapsedGroups,
    toggleGroupCollapsed,
    selectedIds,
    deselectAll,
    sortField,
    sortDirection,
  } = useTimelineStore();

  const reorderMutation = useReorderMilestones();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Group milestones
  const groupedMilestones = useMemo((): GroupedMilestones[] => {
    if (groupBy === "none") {
      return [{ key: "all", label: "All Items", milestones }];
    }

    const groups = new Map<string, Milestone[]>();

    milestones.forEach((milestone) => {
      let key: string;
      switch (groupBy) {
        case "status":
          key = milestone.status;
          break;
        case "priority":
          key = milestone.priority;
          break;
        case "team":
          key = milestone.teamId || "unassigned";
          break;
        default:
          key = "all";
      }

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(milestone);
    });

    // Convert to array with labels
    const result: GroupedMilestones[] = [];

    if (groupBy === "status") {
      Object.entries(statusConfig).forEach(([key, config]) => {
        if (groups.has(key)) {
          result.push({
            key,
            label: config.label,
            milestones: groups.get(key)!,
          });
        }
      });
    } else if (groupBy === "priority") {
      Object.entries(priorityConfig).forEach(([key, config]) => {
        if (groups.has(key)) {
          result.push({
            key,
            label: config.label,
            milestones: groups.get(key)!,
          });
        }
      });
    } else if (groupBy === "team") {
      // Unassigned first
      if (groups.has("unassigned")) {
        result.push({
          key: "unassigned",
          label: "Unassigned",
          milestones: groups.get("unassigned")!,
        });
      }
      // Then teams
      teams.forEach((team) => {
        if (groups.has(team.id)) {
          result.push({
            key: team.id,
            label: team.name,
            color: team.color,
            milestones: groups.get(team.id)!,
          });
        }
      });
    }

    return result;
  }, [milestones, groupBy, teams]);

  // Handle drag end for reordering
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const allIds = milestones.map((m) => m.id);
        const oldIndex = allIds.indexOf(active.id as string);
        const newIndex = allIds.indexOf(over.id as string);

        if (oldIndex !== -1 && newIndex !== -1) {
          // Calculate new sort orders
          const newOrder = [...milestones];
          const [removed] = newOrder.splice(oldIndex, 1);
          newOrder.splice(newIndex, 0, removed);

          const items = newOrder.map((m, index) => ({
            id: m.id,
            sortOrder: index,
          }));

          reorderMutation.mutate({ projectId, items });
        }
      }
    },
    [milestones, projectId, reorderMutation]
  );

  const handleBulkStatusChange = (status: Milestone["status"]) => {
    onBulkStatusChange(selectedIds, status);
    deselectAll();
  };

  const handleBulkPriorityChange = (priority: Milestone["priority"]) => {
    onBulkPriorityChange(selectedIds, priority);
    deselectAll();
  };

  const handleBulkTeamChange = (teamId: string | null) => {
    onBulkTeamChange(selectedIds, teamId);
    deselectAll();
  };

  const handleBulkDelete = () => {
    onBulkDelete(selectedIds);
    deselectAll();
  };

  const canReorder = groupBy === "none" && sortField === "sortOrder";

  return (
    <div className="relative h-full">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis]}
      >
        <SortableContext
          items={milestones.map((m) => m.id)}
          strategy={verticalListSortingStrategy}
          disabled={!canReorder}
        >
          <ListTable
            groupedMilestones={groupedMilestones}
            collapsedGroups={collapsedGroups}
            onToggleGroup={toggleGroupCollapsed}
            teams={teams}
            onEdit={onEdit}
            onDelete={onDelete}
            onStatusChange={onStatusChange}
            onPriorityChange={onPriorityChange}
            canReorder={canReorder}
            allMilestoneIds={milestones.map((m) => m.id)}
          />
        </SortableContext>
      </DndContext>

      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <ListBulkActions
          selectedCount={selectedIds.length}
          teams={teams}
          onStatusChange={handleBulkStatusChange}
          onPriorityChange={handleBulkPriorityChange}
          onTeamChange={handleBulkTeamChange}
          onDelete={handleBulkDelete}
          onClearSelection={deselectAll}
        />
      )}
    </div>
  );
}
