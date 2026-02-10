"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  ColumnOrderState,
  ColumnSizingState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  useReactTable,
  GroupingState,
  Row,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { FeaturesDataTableToolbar } from "./data-table-toolbar";
import { FeatureSheet } from "@/components/feature-sheet";
import { useFeaturesTableStore } from "@/store/features-table-store";
import type { Milestone, MilestoneDependency, Team, MilestoneStatus } from "@/db/schema";

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
  duration: number;
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
  teams: Team[];
  dependencies: MilestoneDependency[];
  onUpdateFeature: (data: Partial<Milestone> & { id: string; duration?: number }) => Promise<void>;
  onDeleteFeature: (id: string) => Promise<void>;
  onFeatureSelect?: (feature: TData) => void;
}

const ROW_HEIGHT = 40;

export function FeaturesDataTable<TData, TValue>({
  columns,
  data,
  milestoneOptions,
  teams,
  dependencies,
  onUpdateFeature,
  onDeleteFeature,
  onFeatureSelect,
}: DataTableProps<TData, TValue>) {
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [grouping, setGrouping] = React.useState<GroupingState>([]);
  const [expanded, setExpanded] = React.useState({});

  const storedVisibility = useFeaturesTableStore((s) => s.columnVisibility);
  const setColumnVisibility = useFeaturesTableStore((s) => s.setColumnVisibility);
  const columnVisibility = React.useMemo(
    () => ({ ...storedVisibility, status: false }),
    [storedVisibility]
  );
  const columnOrder = useFeaturesTableStore((s) => s.columnOrder);
  const setColumnOrder = useFeaturesTableStore((s) => s.setColumnOrder);
  const columnSizing = useFeaturesTableStore((s) => s.columnSizing);
  const setColumnSizing = useFeaturesTableStore((s) => s.setColumnSizing);
  const [selectedFeature, setSelectedFeature] = React.useState<Feature | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  // Drag-and-drop state
  const [draggedColumnId, setDraggedColumnId] = React.useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = React.useState<string | null>(null);

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
      columnOrder,
      columnSizing,
      columnPinning: {
        left: ["select", "title"],
      },
    },
    enableRowSelection: true,
    enableGrouping: true,
    enableColumnPinning: true,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGroupingChange: setGrouping,
    onExpandedChange: setExpanded,
    onColumnOrderChange: setColumnOrder,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  const { rows } = table.getRowModel();

  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = React.useState(0);
  React.useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setViewportWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });

  // Flat list of visible headers and their leaf columns in order
  const leafColumns = table.getVisibleLeafColumns();
  const pinnedIds = new Set(["select", "title"]);

  // Calculate left offsets for pinned columns
  const pinnedMeta = React.useMemo(() => {
    const meta: { id: string; offset: number; size: number; isLast: boolean }[] = [];
    let acc = 0;
    for (const col of leafColumns) {
      if (!pinnedIds.has(col.id)) break;
      meta.push({ id: col.id, offset: acc, size: col.getSize(), isLast: false });
      acc += col.getSize();
    }
    if (meta.length > 0) {
      meta[meta.length - 1].isLast = true;
    }
    return meta;
  }, [leafColumns, table.getState().columnSizing]);

  const getPinMeta = (colId: string) => pinnedMeta.find((m) => m.id === colId);

  // Column reorder handlers
  const handleDragStart = (e: React.DragEvent, columnId: string) => {
    if (pinnedIds.has(columnId)) return;
    setDraggedColumnId(columnId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", columnId);
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    if (pinnedIds.has(columnId)) return;
    if (columnId !== draggedColumnId) {
      setDropTargetId(columnId);
    }
  };

  const handleDragEnd = () => {
    if (draggedColumnId && dropTargetId && draggedColumnId !== dropTargetId) {
      const currentOrder = columnOrder.length
        ? [...columnOrder]
        : table.getAllLeafColumns().map((c) => c.id);

      const dragIndex = currentOrder.indexOf(draggedColumnId);
      const dropIndex = currentOrder.indexOf(dropTargetId);

      if (dragIndex >= 0 && dropIndex >= 0) {
        currentOrder.splice(dragIndex, 1);
        currentOrder.splice(dropIndex, 0, draggedColumnId);
        setColumnOrder(currentOrder);
      }
    }
    setDraggedColumnId(null);
    setDropTargetId(null);
  };


  return (
    <div className="relative flex flex-col flex-1 min-h-0 gap-4">
      <FeaturesDataTableToolbar
        table={table}
        milestoneOptions={milestoneOptions}
        grouping={grouping}
        onGroupingChange={setGrouping}
      />

      <div className="flex-1 min-h-0 rounded-md border overflow-hidden">
        <div
          ref={scrollContainerRef}
          className="h-full overflow-auto"
        >
          <div>
            {/* Header */}
            <div
              className="sticky top-0 z-20 bg-background border-b"
              role="row"
            >
              <div className="flex min-w-full">
                {table.getFlatHeaders().map((header) => {
                  const colId = header.column.id;
                  const pin = getPinMeta(colId);
                  const isPinned = !!pin;
                  const canDrag = !isPinned && colId !== "select";
                  const isDragTarget = dropTargetId === colId;
                  const canResize = header.column.getCanResize();

                  return (
                    <div
                      key={header.id}
                      role="columnheader"
                      draggable={canDrag}
                      onDragStart={canDrag ? (e) => handleDragStart(e, colId) : undefined}
                      onDragOver={canDrag ? (e) => handleDragOver(e, colId) : undefined}
                      onDragEnd={canDrag ? handleDragEnd : undefined}
                      onDragLeave={canDrag ? () => setDropTargetId(null) : undefined}
                      className={cn(
                        "group/header flex items-center gap-1 h-10 pl-3 pr-4 text-left font-medium whitespace-nowrap text-muted-foreground relative select-none shrink-0",
                        "[&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
                        isPinned && "z-30 bg-background",
                        canDrag && "cursor-grab active:cursor-grabbing",
                        isDragTarget && "bg-accent/30",
                        draggedColumnId === colId && "opacity-50"
                      )}
                      style={{
                        width: header.getSize(),
                        minWidth: header.getSize(),
                        flexShrink: 0,
                        ...(pin ? { position: "sticky", left: pin.offset, zIndex: 30 } : {}),
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </div>

                      {/* Resize handle */}
                      {canResize && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          onDoubleClick={() => header.column.resetSize()}
                          className={cn(
                            "absolute right-0 top-0 bottom-0 w-2 cursor-col-resize select-none touch-none",
                            "hover:bg-primary/30 active:bg-primary/50",
                            header.column.getIsResizing() && "bg-primary/50"
                          )}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Body */}
            <div
              style={{ height: virtualizer.getTotalSize(), position: "relative" }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const row = rows[virtualRow.index] as Row<TData>;

                if (row.getIsGrouped()) {
                  return (
                    <div
                      key={row.id}
                      data-index={virtualRow.index}
                      ref={(node) => virtualizer.measureElement(node)}
                      className="flex items-center bg-muted/50 hover:bg-muted/70 border-b"
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${virtualRow.start}px)`,
                        height: ROW_HEIGHT,
                      }}
                    >
                      <div
                        className="sticky left-0 h-full"
                        style={{ width: viewportWidth || "100%" }}
                      >
                        <button
                          className="flex items-center gap-2 px-3 w-full h-full text-sm text-muted-foreground"
                          onClick={() => row.toggleExpanded()}
                        >
                          {row.getIsExpanded() ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                          <span>{row.groupingValue as string}</span>
                          <Badge variant="outline" className="ml-auto font-normal text-muted-foreground">
                            {row.subRows.length} feature
                            {row.subRows.length !== 1 ? "s" : ""}
                          </Badge>
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={row.id}
                    data-index={virtualRow.index}
                    ref={(node) => virtualizer.measureElement(node)}
                    data-state={row.getIsSelected() ? "selected" : undefined}
                    className={cn(
                      "group flex items-center hover:bg-muted data-[state=selected]:bg-muted cursor-pointer shadow-[inset_0_-1px_0_0_var(--color-border)]",
                      row.depth > 0 && "bg-background"
                    )}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      minWidth: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                      height: ROW_HEIGHT,
                    }}
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.closest('button[role="checkbox"]')) return;
                      setSelectedFeature(row.original as Feature);
                      onFeatureSelect?.(row.original);
                      setSheetOpen(true);
                    }}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const colId = cell.column.id;
                      const pin = getPinMeta(colId);
                      const isPinned = !!pin;

                      return (
                        <div
                          key={cell.id}
                          className={cn(
                            "px-3 flex items-center whitespace-nowrap shrink-0 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
                            isPinned && "bg-background group-hover:bg-muted group-data-[state=selected]:bg-muted shadow-[inset_0_-1px_0_0_var(--color-border)]"
                          )}
                          style={{
                            width: cell.column.getSize(),
                            minWidth: cell.column.getSize(),
                            height: ROW_HEIGHT,
                            flexShrink: 0,
                            ...(pin ? { position: "sticky", left: pin.offset, zIndex: 10 } : {}),
                          }}
                        >
                          {cell.getIsGrouped()
                            ? null
                            : cell.getIsAggregated()
                              ? flexRender(
                                  cell.column.columnDef.aggregatedCell ??
                                    cell.column.columnDef.cell,
                                  cell.getContext()
                                )
                              : cell.getIsPlaceholder()
                                ? null
                                : flexRender(
                                    cell.column.columnDef.cell,
                                    cell.getContext()
                                  )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {rows.length === 0 && (
            <div className="h-24 flex items-center justify-center text-muted-foreground">
              No features found.
            </div>
          )}
        </div>
      </div>

      {/* Bulk selection bar */}
      {table.getFilteredSelectedRowModel().rows.length > 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border bg-background px-4 py-2 shadow-lg">
          <span className="text-sm font-medium">
            {table.getFilteredSelectedRowModel().rows.length} selected
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => table.toggleAllRowsSelected(false)}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      )}

      <FeatureSheet
        feature={selectedFeature as unknown as Milestone | null}
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setSelectedFeature(null);
        }}
        teams={teams}
        dependencies={dependencies}
        projectName={selectedFeature?.milestoneName}
        onUpdate={onUpdateFeature}
        onDelete={onDeleteFeature}
      />
    </div>
  );
}
