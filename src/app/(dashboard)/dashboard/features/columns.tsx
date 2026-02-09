"use client";

import { useState, useEffect } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { format, getYear } from "date-fns";
import {
  Circle,
  CircleCheck,
  ChevronUp,
  ChevronDown,
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

type DurationUnit = "d" | "w" | "mo" | "y";

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

  const increment = () => {
    const next = numValue + 1;
    setNumValue(next);
    commit(next, unit);
  };

  const decrement = () => {
    const next = Math.max(1, numValue - 1);
    setNumValue(next);
    commit(next, unit);
  };

  return (
    <div
      className="flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="relative flex items-center">
        <input
          type="number"
          min={1}
          className="h-7 w-14 rounded-md border border-input bg-transparent pl-1.5 pr-5 text-xs tabular-nums text-center outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
        <div className="absolute right-0 inset-y-0 flex flex-col border-l">
          <button
            type="button"
            tabIndex={-1}
            onClick={increment}
            className="flex-1 flex items-center justify-center px-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded-tr-md transition-colors"
          >
            <ChevronUp className="h-2.5 w-2.5" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={decrement}
            className="flex-1 flex items-center justify-center px-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded-br-md transition-colors"
          >
            <ChevronDown className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>
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

function CompletedCell({
  status,
  featureId,
  onToggleComplete,
}: {
  status: Feature["status"];
  featureId: string;
  onToggleComplete: (id: string, completed: boolean) => void;
}) {
  const isCompleted = status === "completed";

  return (
    <button
      className="flex items-center rounded p-0.5 -m-0.5 hover:bg-muted/50 transition-colors"
      onClick={(e) => {
        e.stopPropagation();
        onToggleComplete(featureId, !isCompleted);
      }}
      title={isCompleted ? "Mark incomplete" : "Mark completed"}
    >
      {isCompleted ? (
        <CircleCheck className="h-4 w-4 text-green-500" fill="currentColor" />
      ) : (
        <Circle className="h-4 w-4 text-muted-foreground/40" />
      )}
    </button>
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
  onToggleComplete: (id: string, completed: boolean) => void,
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
      id: "completed",
      header: "",
      cell: ({ row }) => (
        <CompletedCell
          status={row.original.status}
          featureId={row.original.id}
          onToggleComplete={onToggleComplete}
        />
      ),
      size: 36,
      enableSorting: false,
      enableHiding: false,
      enableResizing: false,
    },
    {
      accessorKey: "title",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Title" />
      ),
      cell: ({ row }) => {
        const isCompleted = row.original.status === "completed";
        return (
          <div
            className={cn(
              "truncate font-medium",
              isCompleted && "text-muted-foreground line-through",
            )}
          >
            {row.getValue("title")}
          </div>
        );
      },
      size: 200,
      minSize: 100,
      maxSize: 600,
      enableResizing: true,
      enablePinning: true,
    },
    {
      accessorKey: "status",
      header: "Status",
      enableHiding: true,
      enableSorting: false,
      size: 0,
      filterFn: (row, id, value: string[]) => {
        if (!value.length) return true;
        return value.includes(row.getValue(id));
      },
      meta: { hidden: true },
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
