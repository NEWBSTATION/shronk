"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ViewType = "timeline" | "list";
export type TimePeriod = "week" | "month" | "quarter" | "year";
export type RowHeight = "compact" | "default" | "tall";
export type GroupBy = "none" | "status" | "priority";
export type DragMode = "move" | "resize-start" | "resize-end" | "create-dependency";

export interface DragState {
  mode: DragMode;
  itemId: string;
  startX: number;
  startY: number;
  originalStartDate: Date;
  originalEndDate: Date;
  previewStartDate?: Date;
  previewEndDate?: Date;
  targetItemId?: string;
}

export interface Filters {
  status: string[];
  priority: string[];
  search: string;
  dateRange?: { start: Date; end: Date };
}

interface TimelineStore {
  // View preferences
  viewType: ViewType;
  timePeriod: TimePeriod;
  zoomLevel: number;
  showDependencies: boolean;
  sidebarCollapsed: boolean;

  // Per-milestone view preferences (keyed by project/milestone ID)
  milestoneTimePeriods: Record<string, TimePeriod>;
  milestoneZoomLevels: Record<string, number>;

  // List view preferences
  rowHeight: RowHeight;
  groupBy: GroupBy;
  collapsedGroups: string[];

  // Filters
  filters: Filters;

  // Sort
  sortField: string;
  sortDirection: "asc" | "desc";

  // Selection
  selectedIds: string[];
  lastSelectedId: string | null;

  // UI state
  editingItemId: string | null;
  editingField: string | null;
  dragState: DragState | null;
  isCreatingItem: boolean;
  contextMenuPosition: { x: number; y: number } | null;
  contextMenuItemId: string | null;

  // Timeline scroll position
  timelineScrollLeft: number;

  // Grid column width (left panel)
  gridColumnWidth: number;

  // Team visibility (null = uninitialized, [] = user explicitly hid all)
  visibleTeamIds: string[] | null;

  // Actions
  setViewType: (viewType: ViewType) => void;
  setTimePeriod: (period: TimePeriod) => void;
  getMilestoneTimePeriod: (milestoneId: string) => TimePeriod;
  setMilestoneTimePeriod: (milestoneId: string, period: TimePeriod) => void;
  setZoomLevel: (level: number) => void;
  getMilestoneZoomLevel: (milestoneId: string) => number;
  setMilestoneZoomLevel: (milestoneId: string, level: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setShowDependencies: (show: boolean) => void;
  toggleSidebar: () => void;

  setRowHeight: (height: RowHeight) => void;
  setGroupBy: (groupBy: GroupBy) => void;
  toggleGroupCollapsed: (groupId: string) => void;
  expandAllGroups: () => void;
  collapseAllGroups: (groupIds: string[]) => void;

  setFilters: (filters: Partial<Filters>) => void;
  clearFilters: () => void;
  setStatusFilter: (status: string[]) => void;
  setPriorityFilter: (priority: string[]) => void;
  setSearchFilter: (search: string) => void;

  setSortField: (field: string) => void;
  setSortDirection: (direction: "asc" | "desc") => void;
  toggleSortDirection: () => void;

  selectItem: (id: string, shiftKey?: boolean, allIds?: string[]) => void;
  deselectItem: (id: string) => void;
  selectAll: (ids: string[]) => void;
  deselectAll: () => void;
  toggleItemSelection: (id: string) => void;

  setEditingItem: (id: string | null, field?: string | null) => void;
  setDragState: (state: DragState | null) => void;
  setIsCreatingItem: (creating: boolean) => void;
  setContextMenu: (position: { x: number; y: number } | null, itemId?: string | null) => void;
  setTimelineScrollLeft: (left: number) => void;
  setGridColumnWidth: (width: number) => void;

  setVisibleTeamIds: (ids: string[] | null) => void;
  toggleTeamVisibility: (teamId: string) => void;
}

const defaultFilters: Filters = {
  status: [],
  priority: [],
  search: "",
};

export const useTimelineStore = create<TimelineStore>()(
  persist(
    (set, get) => ({
      // Initial state
      viewType: "timeline",
      timePeriod: "month",
      zoomLevel: 5,
      showDependencies: true,
      sidebarCollapsed: false,
      milestoneTimePeriods: {},
      milestoneZoomLevels: {},
      rowHeight: "default",
      groupBy: "none",
      collapsedGroups: [],
      filters: defaultFilters,
      sortField: "sortOrder",
      sortDirection: "asc",
      selectedIds: [],
      lastSelectedId: null,
      editingItemId: null,
      editingField: null,
      dragState: null,
      isCreatingItem: false,
      contextMenuPosition: null,
      contextMenuItemId: null,
      timelineScrollLeft: 0,
      gridColumnWidth: 200,
      visibleTeamIds: null,

      // Actions
      setViewType: (viewType) => set({ viewType }),

      setTimePeriod: (timePeriod) => set({ timePeriod }),

      getMilestoneTimePeriod: (milestoneId) => {
        const stored = get().milestoneTimePeriods[milestoneId];
        const valid: TimePeriod[] = ["week", "month", "quarter", "year"];
        return stored && valid.includes(stored) ? stored : "month";
      },

      setMilestoneTimePeriod: (milestoneId, timePeriod) =>
        set((state) => ({
          milestoneTimePeriods: {
            ...state.milestoneTimePeriods,
            [milestoneId]: timePeriod,
          },
        })),

      setZoomLevel: (zoomLevel) =>
        set({ zoomLevel: Math.min(10, Math.max(1, zoomLevel)) }),

      getMilestoneZoomLevel: (milestoneId) => {
        const stored = get().milestoneZoomLevels[milestoneId];
        return stored != null ? stored : 5;
      },

      setMilestoneZoomLevel: (milestoneId, level) =>
        set((state) => ({
          milestoneZoomLevels: {
            ...state.milestoneZoomLevels,
            [milestoneId]: Math.min(9, Math.max(1, level)),
          },
        })),

      zoomIn: () => {
        const { zoomLevel } = get();
        set({ zoomLevel: Math.min(10, zoomLevel + 1) });
      },

      zoomOut: () => {
        const { zoomLevel } = get();
        set({ zoomLevel: Math.max(1, zoomLevel - 1) });
      },

      setShowDependencies: (showDependencies) => set({ showDependencies }),

      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      setRowHeight: (rowHeight) => set({ rowHeight }),

      setGroupBy: (groupBy) => set({ groupBy, collapsedGroups: [] }),

      toggleGroupCollapsed: (groupId) =>
        set((state) => ({
          collapsedGroups: state.collapsedGroups.includes(groupId)
            ? state.collapsedGroups.filter((id) => id !== groupId)
            : [...state.collapsedGroups, groupId],
        })),

      expandAllGroups: () => set({ collapsedGroups: [] }),

      collapseAllGroups: (groupIds) => set({ collapsedGroups: groupIds }),

      setFilters: (filters) =>
        set((state) => ({ filters: { ...state.filters, ...filters } })),

      clearFilters: () => set({ filters: defaultFilters }),

      setStatusFilter: (status) =>
        set((state) => ({ filters: { ...state.filters, status } })),

      setPriorityFilter: (priority) =>
        set((state) => ({ filters: { ...state.filters, priority } })),

      setSearchFilter: (search) =>
        set((state) => ({ filters: { ...state.filters, search } })),

      setSortField: (sortField) => set({ sortField }),

      setSortDirection: (sortDirection) => set({ sortDirection }),

      toggleSortDirection: () =>
        set((state) => ({
          sortDirection: state.sortDirection === "asc" ? "desc" : "asc",
        })),

      selectItem: (id, shiftKey = false, allIds = []) => {
        const { lastSelectedId, selectedIds } = get();

        if (shiftKey && lastSelectedId && allIds.length > 0) {
          // Range selection
          const lastIndex = allIds.indexOf(lastSelectedId);
          const currentIndex = allIds.indexOf(id);
          if (lastIndex !== -1 && currentIndex !== -1) {
            const start = Math.min(lastIndex, currentIndex);
            const end = Math.max(lastIndex, currentIndex);
            const rangeIds = allIds.slice(start, end + 1);
            const newSelectedIds = [...new Set([...selectedIds, ...rangeIds])];
            set({ selectedIds: newSelectedIds, lastSelectedId: id });
            return;
          }
        }

        set({ selectedIds: [id], lastSelectedId: id });
      },

      deselectItem: (id) =>
        set((state) => ({
          selectedIds: state.selectedIds.filter((i) => i !== id),
        })),

      selectAll: (ids) => set({ selectedIds: ids }),

      deselectAll: () => set({ selectedIds: [], lastSelectedId: null }),

      toggleItemSelection: (id) =>
        set((state) => ({
          selectedIds: state.selectedIds.includes(id)
            ? state.selectedIds.filter((i) => i !== id)
            : [...state.selectedIds, id],
          lastSelectedId: id,
        })),

      setEditingItem: (editingItemId, editingField = null) =>
        set({ editingItemId, editingField }),

      setDragState: (dragState) => set({ dragState }),

      setIsCreatingItem: (isCreatingItem) => set({ isCreatingItem }),

      setContextMenu: (contextMenuPosition, contextMenuItemId = null) =>
        set({ contextMenuPosition, contextMenuItemId }),

      setTimelineScrollLeft: (timelineScrollLeft) => set({ timelineScrollLeft }),

      setGridColumnWidth: (gridColumnWidth) => set({ gridColumnWidth }),

      setVisibleTeamIds: (visibleTeamIds) => set({ visibleTeamIds }),

      toggleTeamVisibility: (teamId) =>
        set((state) => {
          const current = state.visibleTeamIds ?? [];
          return {
            visibleTeamIds: current.includes(teamId)
              ? current.filter((id) => id !== teamId)
              : [...current, teamId],
          };
        }),
    }),
    {
      name: "shronk-timeline-storage",
      partialize: (state) => ({
        viewType: state.viewType,
        timePeriod: state.timePeriod,
        zoomLevel: state.zoomLevel,
        showDependencies: state.showDependencies,
        sidebarCollapsed: state.sidebarCollapsed,
        rowHeight: state.rowHeight,
        groupBy: state.groupBy,
        sortField: state.sortField,
        sortDirection: state.sortDirection,
        milestoneTimePeriods: state.milestoneTimePeriods,
        milestoneZoomLevels: state.milestoneZoomLevels,
        visibleTeamIds: state.visibleTeamIds,
        gridColumnWidth: state.gridColumnWidth,
      }),
    }
  )
);
