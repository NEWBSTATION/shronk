"use client";

import { Column } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown, EyeOff, Check } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useFeaturesTableStore,
  type DurationDisplayUnit,
} from "@/store/features-table-store";

const DISPLAY_UNIT_OPTIONS: { value: DurationDisplayUnit; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "days", label: "Days" },
  { value: "weeks", label: "Weeks" },
  { value: "months", label: "Months" },
  { value: "years", label: "Years" },
];

interface DataTableColumnHeaderProps<TData, TValue>
  extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>;
  title: string;
  isDuration?: boolean;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
  isDuration,
}: DataTableColumnHeaderProps<TData, TValue>) {
  const durationDisplayUnit = useFeaturesTableStore((s) => s.durationDisplayUnit);
  const setDurationDisplayUnit = useFeaturesTableStore((s) => s.setDurationDisplayUnit);
  const isSorted = column.getIsSorted();

  if (!column.getCanSort()) {
    return (
      <div className={cn("text-xs font-medium text-muted-foreground", className)}>
        {title}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "-mx-1.5 flex items-center gap-1 h-7 px-1.5 rounded-md text-xs font-medium text-muted-foreground",
              "hover:text-foreground hover:bg-accent transition-colors",
              "data-[state=open]:bg-accent/50 data-[state=open]:text-foreground",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              isSorted && "text-foreground"
            )}
          >
            <span>{title}</span>
            {isSorted === "desc" ? (
              <ArrowDown className="h-3.5 w-3.5 shrink-0" />
            ) : isSorted === "asc" ? (
              <ArrowUp className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover/header:opacity-100 transition-opacity" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
            <ArrowUp className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
            Asc
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
            <ArrowDown className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
            Desc
          </DropdownMenuItem>
          {isSorted && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => column.clearSorting()}>
                <ChevronsUpDown className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
                Unsort
              </DropdownMenuItem>
            </>
          )}
          {isDuration && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  Display as
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {DISPLAY_UNIT_OPTIONS.map((opt) => (
                    <DropdownMenuItem
                      key={opt.value}
                      onClick={() => setDurationDisplayUnit(opt.value)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-3.5 w-3.5",
                          durationDisplayUnit === opt.value
                            ? "opacity-100"
                            : "opacity-0",
                        )}
                      />
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
            <EyeOff className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
            Hide
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
