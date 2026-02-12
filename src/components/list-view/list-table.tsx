"use client";

import { useMemo } from "react";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTimelineStore } from "@/store/timeline-store";
import { ListRow } from "./list-row";
import { ListGroupHeader } from "./list-group-header";
import type { Milestone } from "@/db/schema";

interface GroupedMilestones {
  key: string;
  label: string;
  color?: string;
  milestones: Milestone[];
}

interface ListTableProps {
  groupedMilestones: GroupedMilestones[];
  collapsedGroups: string[];
  onToggleGroup: (key: string) => void;
  onEdit: (milestone: Milestone) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: Milestone["status"]) => void;
  onPriorityChange: (id: string, priority: Milestone["priority"]) => void;
  canReorder: boolean;
  allMilestoneIds: string[];
}

export function ListTable({
  groupedMilestones,
  collapsedGroups,
  onToggleGroup,
  onEdit,
  onDelete,
  onStatusChange,
  onPriorityChange,
  canReorder,
  allMilestoneIds,
}: ListTableProps) {
  const { selectedIds, selectAll, deselectAll, groupBy, rowHeight } =
    useTimelineStore();

  const allSelected =
    allMilestoneIds.length > 0 &&
    allMilestoneIds.every((id) => selectedIds.includes(id));

  const someSelected =
    selectedIds.length > 0 && !allSelected;

  const handleSelectAll = () => {
    if (allSelected) {
      deselectAll();
    } else {
      selectAll(allMilestoneIds);
    }
  };

  const rowHeightClass = {
    compact: "h-11",
    default: "h-13",
    tall: "h-16",
  }[rowHeight];

  return (
    <ScrollArea className="h-full">
      <Table>
        <TableHeader className="sticky top-0 bg-background z-10">
          <TableRow className={rowHeightClass}>
            <TableHead className="w-12">
              <Checkbox
                checked={allSelected}
                onCheckedChange={handleSelectAll}
                aria-label="Select all"
                className={someSelected ? "data-[state=checked]:bg-primary/50" : ""}
              />
            </TableHead>
            {canReorder && <TableHead className="w-10"></TableHead>}
            <TableHead className="w-12"></TableHead>
            <TableHead className="min-w-[200px]">Title</TableHead>
            <TableHead className="w-[100px]">Priority</TableHead>
            <TableHead className="w-[180px]">Date Range</TableHead>
            <TableHead className="w-[80px]">Progress</TableHead>
            <TableHead className="w-[60px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groupedMilestones.map((group) => {
            const isCollapsed = collapsedGroups.includes(group.key);
            const showGroupHeader = groupBy !== "none";

            return (
              <ListGroupContent
                key={group.key}
                group={group}
                isCollapsed={isCollapsed}
                showGroupHeader={showGroupHeader}
                onToggleGroup={onToggleGroup}
                onEdit={onEdit}
                onDelete={onDelete}
                onStatusChange={onStatusChange}
                onPriorityChange={onPriorityChange}
                canReorder={canReorder}
                allMilestoneIds={allMilestoneIds}
                rowHeightClass={rowHeightClass}
              />
            );
          })}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

interface ListGroupContentProps {
  group: GroupedMilestones;
  isCollapsed: boolean;
  showGroupHeader: boolean;
  onToggleGroup: (key: string) => void;
  onEdit: (milestone: Milestone) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: Milestone["status"]) => void;
  onPriorityChange: (id: string, priority: Milestone["priority"]) => void;
  canReorder: boolean;
  allMilestoneIds: string[];
  rowHeightClass: string;
}

function ListGroupContent({
  group,
  isCollapsed,
  showGroupHeader,
  onToggleGroup,
  onEdit,
  onDelete,
  onStatusChange,
  onPriorityChange,
  canReorder,
  allMilestoneIds,
  rowHeightClass,
}: ListGroupContentProps) {
  return (
    <>
      {showGroupHeader && (
        <ListGroupHeader
          groupKey={group.key}
          label={group.label}
          color={group.color}
          count={group.milestones.length}
          isCollapsed={isCollapsed}
          onToggle={() => onToggleGroup(group.key)}
          colSpan={canReorder ? 8 : 7}
        />
      )}
      {!isCollapsed &&
        group.milestones.map((milestone) => (
          <ListRow
            key={milestone.id}
            milestone={milestone}
            onEdit={() => onEdit(milestone)}
            onDelete={() => onDelete(milestone.id)}
            onStatusChange={(status) => onStatusChange(milestone.id, status)}
            onPriorityChange={(priority) =>
              onPriorityChange(milestone.id, priority)
            }
            canReorder={canReorder}
            allMilestoneIds={allMilestoneIds}
            className={rowHeightClass}
          />
        ))}
    </>
  );
}
