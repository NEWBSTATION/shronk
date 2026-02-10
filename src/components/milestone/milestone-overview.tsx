"use client";

import { useState, useMemo } from "react";
import { format, differenceInDays } from "date-fns";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, Plus, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Project } from "@/db/schema";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface MilestoneStats {
  milestoneId: string;
  featureCount: number;
  completedFeatureCount: number;
}

/** Flattened row data for the table — Project + stats */
interface MilestoneRow {
  id: string;
  name: string;
  description: string | null;
  startDate: Date | null;
  endDate: Date | null;
  featureCount: number;
  completedFeatureCount: number;
  progress: number;
  isCompleted: boolean;
  isOverdue: boolean;
  daysRemaining: number | null;
}

/* -------------------------------------------------------------------------- */
/*  Column definitions (Dougly style — sortable ghost buttons)                 */
/* -------------------------------------------------------------------------- */

const columns: ColumnDef<MilestoneRow>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 text-muted-foreground"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Title
        <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="flex items-center gap-2 font-medium">
        <span
          className={cn(
            "h-2 w-2 rounded-full shrink-0",
            row.original.isCompleted
              ? "bg-green-500"
              : row.original.isOverdue
                ? "bg-destructive"
                : row.original.progress > 0
                  ? "bg-primary"
                  : "bg-muted-foreground/40"
          )}
        />
        {row.getValue("name")}
      </div>
    ),
  },
  {
    accessorKey: "startDate",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 text-muted-foreground"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Date Range
        <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
      </Button>
    ),
    cell: ({ row }) => {
      const start = row.original.startDate;
      const end = row.original.endDate;
      return (
        <div className="text-muted-foreground">
          {start && end
            ? `${format(start, "MMM d")} – ${format(end, "MMM d")}`
            : "—"}
        </div>
      );
    },
  },
  {
    accessorKey: "progress",
    header: "Progress",
    cell: ({ row }) => {
      const { featureCount, completedFeatureCount, progress, isCompleted, isOverdue } =
        row.original;
      if (featureCount === 0) {
        return <span className="text-muted-foreground">—</span>;
      }
      return (
        <div className="flex items-center gap-2 min-w-24">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500 ease-out",
                isCompleted
                  ? "bg-green-500"
                  : isOverdue
                    ? "bg-destructive"
                    : "bg-primary"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {completedFeatureCount}/{featureCount}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "isCompleted",
    header: "Status",
    cell: ({ row }) => {
      const { isCompleted, isOverdue, daysRemaining } = row.original;
      if (isCompleted) {
        return (
          <span className="text-xs font-medium text-green-600 dark:text-green-400">
            Complete
          </span>
        );
      }
      if (isOverdue) {
        return (
          <span className="text-xs font-medium text-destructive">Overdue</span>
        );
      }
      if (daysRemaining !== null) {
        return (
          <span className="text-xs text-muted-foreground">
            {daysRemaining}d left
          </span>
        );
      }
      return <span className="text-xs text-muted-foreground">Active</span>;
    },
  },
];

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

interface MilestoneOverviewProps {
  milestones: Project[];
  stats: MilestoneStats[];
  onSelectMilestone: (milestoneId: string) => void;
  onCreateMilestone: () => void;
}

export function MilestoneOverview({
  milestones,
  stats,
  onSelectMilestone,
  onCreateMilestone,
}: MilestoneOverviewProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  // Flatten milestones + stats into table row data — must be memoized so
  // useReactTable doesn't see a new reference on every render (which triggers
  // autoResetSorting → setSorting([]) → re-render → infinite loop).
  const data = useMemo<MilestoneRow[]>(() => {
    const now = new Date();
    return milestones.map((m) => {
      const s = stats.find((st) => st.milestoneId === m.id) || {
        featureCount: 0,
        completedFeatureCount: 0,
      };
      const progress =
        s.featureCount > 0
          ? Math.round((s.completedFeatureCount / s.featureCount) * 100)
          : 0;
      const startDate = m.startDate ? new Date(m.startDate) : null;
      const endDate = m.endDate ? new Date(m.endDate) : null;
      const isCompleted = s.featureCount > 0 && progress === 100;
      const isOverdue = !!endDate && endDate < now && !isCompleted;
      const daysRemaining =
        endDate && endDate > now ? differenceInDays(endDate, now) : null;

      return {
        id: m.id,
        name: m.name,
        description: m.description ?? null,
        startDate,
        endDate,
        featureCount: s.featureCount,
        completedFeatureCount: s.completedFeatureCount,
        progress,
        isCompleted,
        isOverdue,
        daysRemaining,
      };
    });
  }, [milestones, stats]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
  });

  if (milestones.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <Target className="h-16 w-16 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-semibold">No milestones yet</h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm">
          Create your first milestone to start organizing features and tracking
          progress.
        </p>
        <Button className="mt-4" onClick={onCreateMilestone}>
          <Plus className="h-4 w-4 mr-2" />
          Create Milestone
        </Button>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id}>
                {header.isPlaceholder
                  ? null
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow
            key={row.id}
            className="cursor-pointer"
            onClick={() => onSelectMilestone(row.original.id)}
          >
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
