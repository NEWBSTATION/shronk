"use client";

import { ColumnDef } from "@tanstack/react-table";
import { format, differenceInDays } from "date-fns";
import {
  Circle,
  Clock,
  PauseCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { DataTableColumnHeader } from "./data-table-column-header";

interface Feature {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  startDate: Date;
  endDate: Date;
  status: "not_started" | "in_progress" | "on_hold" | "completed" | "cancelled";
  teamId: string | null;
  sortOrder: number;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  milestoneName: string;
}

const STATUS_CONFIG = {
  not_started: {
    label: "Not Started",
    icon: Circle,
    className: "text-slate-500",
  },
  in_progress: {
    label: "In Progress",
    icon: Clock,
    className: "text-blue-500",
  },
  on_hold: {
    label: "On Hold",
    icon: PauseCircle,
    className: "text-amber-500",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    className: "text-green-500",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    className: "text-red-400",
  },
};

export const columns: ColumnDef<Feature>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() ? "indeterminate" : false)
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
        className="translate-y-[2px]"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        className="translate-y-[2px]"
      />
    ),
    size: 40,
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "title",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Title" />
    ),
    cell: ({ row }) => (
      <div className="max-w-[250px] truncate font-medium">
        {row.getValue("title")}
      </div>
    ),
    size: 250,
  },
  {
    accessorKey: "milestoneName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Milestone" />
    ),
    cell: ({ row }) => (
      <Badge variant="outline" className="font-normal">
        {row.getValue("milestoneName")}
      </Badge>
    ),
    filterFn: (row, id, value: string[]) => {
      return value.includes(row.original.projectId);
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = row.getValue("status") as Feature["status"];
      const config = STATUS_CONFIG[status];
      const Icon = config.icon;

      return (
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", config.className)} />
          <span className="text-sm">{config.label}</span>
        </div>
      );
    },
    filterFn: (row, id, value: string[]) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: "startDate",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Start" />
    ),
    cell: ({ row }) => {
      const date = row.getValue("startDate") as Date;
      return (
        <div className="w-[90px] text-sm">
          {format(new Date(date), "MMM d, yyyy")}
        </div>
      );
    },
  },
  {
    accessorKey: "endDate",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="End" />
    ),
    cell: ({ row }) => {
      const date = row.getValue("endDate") as Date;
      return (
        <div className="w-[90px] text-sm">
          {format(new Date(date), "MMM d, yyyy")}
        </div>
      );
    },
  },
  {
    id: "duration",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Duration" />
    ),
    cell: ({ row }) => {
      const startDate = new Date(row.getValue("startDate") as Date);
      const endDate = new Date(row.getValue("endDate") as Date);
      const days = differenceInDays(endDate, startDate) + 1;

      let display: string;
      if (days % 7 === 0 && days >= 7) {
        const weeks = days / 7;
        display = `${weeks}w`;
      } else {
        display = `${days}d`;
      }

      return (
        <div className="w-[60px] text-sm text-muted-foreground">{display}</div>
      );
    },
  },
];
