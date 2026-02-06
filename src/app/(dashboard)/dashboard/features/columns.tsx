"use client";

import { useState, useEffect } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { format, getYear } from "date-fns";
import {
  Circle,
  Clock,
  PauseCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { DataTableColumnHeader } from "./data-table-column-header";

interface Feature {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  startDate: Date;
  endDate: Date;
  duration: number;
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

type DurationUnit = "d" | "w" | "mo" | "y";

const UNIT_LABELS: Record<DurationUnit, string> = {
  d: "day",
  w: "wk",
  mo: "mo",
  y: "yr",
};

const UNIT_DAYS: Record<DurationUnit, number> = {
  d: 1,
  w: 7,
  mo: 30,
  y: 365,
};

function bestUnit(days: number): { value: number; unit: DurationUnit } {
  if (days >= 365 && days % 365 === 0) return { value: days / 365, unit: "y" };
  if (days >= 30 && days % 30 === 0) return { value: days / 30, unit: "mo" };
  if (days >= 7 && days % 7 === 0) return { value: days / 7, unit: "w" };
  return { value: days, unit: "d" };
}

function DurationCell({
  duration,
  featureId,
  onDurationChange,
}: {
  duration: number;
  featureId: string;
  onDurationChange: (id: string, duration: number) => void;
}) {
  const initial = bestUnit(duration);
  const [numValue, setNumValue] = useState(initial.value);
  const [unit, setUnit] = useState<DurationUnit>(initial.unit);

  useEffect(() => {
    const best = bestUnit(duration);
    setNumValue(best.value);
    setUnit(best.unit);
  }, [duration]);

  const commit = (val: number, u: DurationUnit) => {
    const days = Math.max(1, Math.round(val * UNIT_DAYS[u]));
    if (days !== duration) {
      onDurationChange(featureId, days);
    }
  };

  return (
    <div
      className="flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="number"
        min={1}
        className="h-7 w-11 rounded-md border border-input bg-transparent px-1.5 text-xs tabular-nums text-center outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        value={numValue}
        onChange={(e) => {
          const v = Math.max(1, parseInt(e.target.value) || 1);
          setNumValue(v);
        }}
        onBlur={() => commit(numValue, unit)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit(numValue, unit);
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
      <select
        className="h-7 rounded-md border border-input bg-transparent px-1 text-xs outline-none cursor-pointer focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        value={unit}
        onChange={(e) => {
          const newUnit = e.target.value as DurationUnit;
          setUnit(newUnit);
          commit(numValue, newUnit);
        }}
      >
        <option value="d">Days</option>
        <option value="w">Weeks</option>
        <option value="mo">Months</option>
        <option value="y">Years</option>
      </select>
    </div>
  );
}

const STATUS_OPTIONS = Object.entries(STATUS_CONFIG).map(([value, config]) => ({
  value: value as Feature["status"],
  ...config,
}));

function StatusCell({
  status,
  featureId,
  onStatusChange,
}: {
  status: Feature["status"];
  featureId: string;
  onStatusChange: (id: string, status: Feature["status"]) => void;
}) {
  const [open, setOpen] = useState(false);
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center rounded p-0.5 -m-0.5 hover:bg-muted/50 transition-colors"
          onClick={(e) => e.stopPropagation()}
          title={config.label}
        >
          <Icon className={cn("h-4 w-4", config.className)} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[160px] p-1" onClick={(e) => e.stopPropagation()}>
        {STATUS_OPTIONS.map((option) => {
          const OptionIcon = option.icon;
          return (
            <button
              key={option.value}
              className={cn(
                "flex items-center gap-2 w-full rounded px-2 py-1.5 text-xs hover:bg-accent transition-colors",
                option.value === status && "bg-accent"
              )}
              onClick={() => {
                if (option.value !== status) {
                  onStatusChange(featureId, option.value);
                }
                setOpen(false);
              }}
            >
              <OptionIcon className={cn("h-3.5 w-3.5", option.className)} />
              {option.label}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

function formatShortDate(date: Date): string {
  const d = new Date(date);
  if (getYear(d) === getYear(new Date())) {
    return format(d, "MMM d");
  }
  return format(d, "MMM d, yyyy");
}

function formatFullDate(date: Date): string {
  return format(new Date(date), "MMMM d, yyyy");
}

function DateCell({
  date,
  featureId,
  field,
  onDateChange,
}: {
  date: Date;
  featureId: string;
  field: "startDate" | "endDate";
  onDateChange: (id: string, field: "startDate" | "endDate", date: Date) => void;
}) {
  const [open, setOpen] = useState(false);
  const d = new Date(date);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="text-sm rounded px-1 -mx-1 hover:bg-muted/50 transition-colors"
          onClick={(e) => e.stopPropagation()}
          title={formatFullDate(date)}
        >
          {formatShortDate(date)}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0" onClick={(e) => e.stopPropagation()}>
        <Calendar
          mode="single"
          selected={d}
          defaultMonth={d}
          onSelect={(selected) => {
            if (selected) {
              onDateChange(featureId, field, selected);
              setOpen(false);
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export function createColumns(
  onDurationChange: (id: string, duration: number) => void,
  onStatusChange: (id: string, status: Feature["status"]) => void,
  onDateChange: (id: string, field: "startDate" | "endDate", date: Date) => void,
): ColumnDef<Feature>[] {
  return [
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
      enableResizing: false,
      enablePinning: true,
    },
    {
      accessorKey: "title",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Title" />
      ),
      cell: ({ row }) => (
        <div className="truncate font-medium">
          {row.getValue("title")}
        </div>
      ),
      size: 200,
      minSize: 100,
      maxSize: 600,
      enableResizing: true,
      enablePinning: true,
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
      size: 150,
      minSize: 90,
      maxSize: 300,
      enableResizing: true,
      filterFn: (row, id, value: string[]) => {
        return value.includes(row.original.projectId);
      },
    },
    {
      accessorKey: "duration",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Duration" />
      ),
      cell: ({ row }) => (
        <DurationCell
          duration={row.original.duration}
          featureId={row.original.id}
          onDurationChange={onDurationChange}
        />
      ),
      size: 155,
      minSize: 150,
      maxSize: 220,
      enableResizing: true,
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => (
        <StatusCell
          status={row.getValue("status") as Feature["status"]}
          featureId={row.original.id}
          onStatusChange={onStatusChange}
        />
      ),
      size: 50,
      minSize: 40,
      maxSize: 80,
      enableResizing: true,
      filterFn: (row, id, value: string[]) => {
        return value.includes(row.getValue(id));
      },
    },
    {
      accessorKey: "startDate",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Start" />
      ),
      cell: ({ row }) => (
        <DateCell
          date={row.getValue("startDate") as Date}
          featureId={row.original.id}
          field="startDate"
          onDateChange={onDateChange}
        />
      ),
      size: 100,
      minSize: 80,
      maxSize: 160,
      enableResizing: true,
    },
    {
      accessorKey: "endDate",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="End" />
      ),
      cell: ({ row }) => (
        <DateCell
          date={row.getValue("endDate") as Date}
          featureId={row.original.id}
          field="endDate"
          onDateChange={onDateChange}
        />
      ),
      size: 100,
      minSize: 80,
      maxSize: 160,
      enableResizing: true,
    },
  ];
}
