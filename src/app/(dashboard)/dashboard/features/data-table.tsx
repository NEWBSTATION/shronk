"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  GroupingState,
} from "@tanstack/react-table";
import { ChevronDown, ChevronRight } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { FeaturesDataTablePagination } from "./data-table-pagination";
import { FeaturesDataTableToolbar } from "./data-table-toolbar";
import { FeatureSheet } from "./feature-sheet";

interface MilestoneOption {
  id: string;
  name: string;
}

interface Feature {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  startDate: Date;
  endDate: Date;
  status: "not_started" | "in_progress" | "on_hold" | "completed" | "cancelled";
  priority: "low" | "medium" | "high" | "critical";
  progress: number;
  teamId: string | null;
  sortOrder: number;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  milestoneName: string;
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  milestoneOptions: MilestoneOption[];
}

export function FeaturesDataTable<TData, TValue>({
  columns,
  data,
  milestoneOptions,
}: DataTableProps<TData, TValue>) {
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [grouping, setGrouping] = React.useState<GroupingState>([]);
  const [expanded, setExpanded] = React.useState({});
  const [selectedFeature, setSelectedFeature] = React.useState<Feature | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      grouping,
      expanded,
    },
    enableRowSelection: true,
    enableGrouping: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGroupingChange: setGrouping,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  return (
    <div className="space-y-4">
      <FeaturesDataTableToolbar
        table={table}
        milestoneOptions={milestoneOptions}
        grouping={grouping}
        onGroupingChange={setGrouping}
      />
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan}>
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
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => {
                // Check if this is a grouped row
                if (row.getIsGrouped()) {
                  return (
                    <TableRow
                      key={row.id}
                      className="bg-muted/50 hover:bg-muted/70"
                    >
                      <TableCell colSpan={columns.length}>
                        <button
                          className="flex items-center gap-2 font-medium"
                          onClick={() => row.toggleExpanded()}
                        >
                          {row.getIsExpanded() ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <span>{row.groupingValue as string}</span>
                          <span className="text-muted-foreground font-normal">
                            ({row.subRows.length} feature
                            {row.subRows.length !== 1 ? "s" : ""})
                          </span>
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                }

                return (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={cn(row.depth > 0 && "bg-background", "cursor-pointer")}
                    onClick={(e) => {
                      // Don't open sheet if clicking on checkbox
                      const target = e.target as HTMLElement;
                      if (target.closest('button[role="checkbox"]')) return;
                      setSelectedFeature(row.original as Feature);
                      setSheetOpen(true);
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {cell.getIsGrouped() ? null : cell.getIsAggregated() ? (
                          flexRender(
                            cell.column.columnDef.aggregatedCell ??
                              cell.column.columnDef.cell,
                            cell.getContext()
                          )
                        ) : cell.getIsPlaceholder() ? null : (
                          flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No features found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <FeaturesDataTablePagination table={table} />

      <FeatureSheet
        feature={selectedFeature}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}
