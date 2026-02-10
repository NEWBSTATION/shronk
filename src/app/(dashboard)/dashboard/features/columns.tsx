"use client";

import { useState, useEffect } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { format, getYear } from "date-fns";
import {
  Circle,
  CircleCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { NumberStepper } from "@/components/ui/number-stepper";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { DataTableColumnHeader } from "./data-table-column-header";
import type { DurationDisplayUnit } from "@/store/features-table-store";

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

type DurationUnit = "days" | "weeks" | "months" | "years";

const UNIT_DAYS: Record<DurationUnit, number> = {
  days: 1,
  weeks: 7,
  months: 30,
  years: 365,
};

function bestUnit(days: number): { value: number; unit: DurationUnit } {
  if (days >= 365 && days % 365 === 0) return { value: days / 365, unit: "years" };
  if (days >= 30 && days % 30 === 0) return { value: days / 30, unit: "months" };
  if (days >= 7 && days % 7 === 0) return { value: days / 7, unit: "weeks" };
  return { value: days, unit: "days" };
}

function toDisplayUnit(days: number, displayUnit: DurationDisplayUnit): { value: number; unit: DurationUnit } {
  if (displayUnit === "auto") return bestUnit(days);
  const unitKey = displayUnit as DurationUnit;
  const divisor = UNIT_DAYS[unitKey];
  const value = Math.round((days / divisor) * 100) / 100;
  return { value, unit: unitKey };
}

function formatDurationLabel(value: number, unit: DurationUnit): string {
  // Handle decimal values cleanly
  const display = Number.isInteger(value) ? value.toString() : value.toFixed(1).replace(/\.0$/, "");
  const singular = unit.slice(0, -1); // "days" → "day"
  return `${display} ${value === 1 ? singular : unit}`;
}

function DurationCell({
  duration,
  featureId,
  displayUnit,
  onDurationChange,
}: {
  duration: number;
  featureId: string;
  displayUnit: DurationDisplayUnit;
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

  const handleValueChange = (val: number) => {
    const clamped = Math.max(1, val);
    setNumValue(clamped);
    commit(clamped, unit);
  };

  const handleUnitChange = (u: DurationUnit) => {
    setUnit(u);
    commit(numValue, u);
  };

  const display = toDisplayUnit(duration, displayUnit);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center h-7 px-1.5 text-xs rounded-md hover:bg-accent transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {formatDurationLabel(display.value, display.unit)}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-3"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <NumberStepper
            value={numValue}
            onChange={handleValueChange}
            min={1}
            className="w-20"
          />
          <Select
            value={unit}
            onValueChange={(v) => handleUnitChange(v as DurationUnit)}
          >
            <SelectTrigger className="h-9 w-[100px] dark:bg-input/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="days">days</SelectItem>
              <SelectItem value="weeks">weeks</SelectItem>
              <SelectItem value="months">months</SelectItem>
              <SelectItem value="years">years</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </PopoverContent>
    </Popover>
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
  durationDisplayUnit: DurationDisplayUnit,
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
        <DataTableColumnHeader column={column} title="Duration" isDuration />
      ),
      cell: ({ row }) => (
        <DurationCell
          duration={row.original.duration}
          featureId={row.original.id}
          displayUnit={durationDisplayUnit}
          onDurationChange={onDurationChange}
        />
      ),
      size: 130,
      minSize: 100,
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
