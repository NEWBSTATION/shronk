"use client";

import { useMemo, useRef, useCallback, useState, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  closestCenter,
  useSensor,
  useSensors,
  useDroppable,
  type CollisionDetection,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useFeaturesListStore } from "@/store/features-list-store";
import { topoSortFeatures } from "@/lib/topo-sort";
import { formatDuration } from "@/lib/format-duration";
import { SectionHeader } from "./section-header";
import { SortableFeatureRow, type TeamDurationInfo, type TeamOption } from "./feature-row";
import { useFeatureContextMenu } from "@/components/shared/feature-context-menu";
import { formatDurationIn } from "@/lib/format-duration";

interface Feature {
  id: string;
  projectId: string;
  title: string;
  startDate: Date | string;
  endDate: Date | string;
  status: string;
  priority: string;
  duration: number;
  sortOrder: number;
  milestoneName: string;
  milestoneColor: string;
  milestoneIcon: string;
}

interface MilestoneOption {
  id: string;
  name: string;
  color: string;
  icon: string;
}

interface Dependency {
  id: string;
  predecessorId: string;
  successorId: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface FeaturesSectionListProps {
  features: Feature[];
  milestones: MilestoneOption[];
  dependencies?: Dependency[];
  teamDurationsMap?: Map<string, TeamDurationInfo[]>;
  allTeams?: TeamOption[];
  /** When non-null, search is active: feature IDs that match */
  searchMatchIds?: Set<string> | null;
  /** When non-null, milestone IDs that contain at least one match */
  searchMatchMilestoneIds?: Set<string> | null;
  onFeatureClick: (feature: any) => void;
  onToggleComplete?: (featureId: string, currentStatus: string) => void;
  onStatusChange?: (featureId: string, newStatus: string) => void;
  onPriorityChange?: (featureId: string, newPriority: string) => void;
  onAddFeature?: (milestoneId: string, e?: React.MouseEvent) => void;
  onEditMilestone?: (milestoneId: string) => void;
  onDeleteMilestone?: (milestoneId: string) => void;
  onUpdateAppearance?: (milestoneId: string, data: { color: string; icon: string }) => void;
  onAddMilestone?: () => void;
  onMoveFeature?: (featureId: string, targetProjectId: string, insertAtIndex?: number) => void;
  onReorderFeatures?: (projectId: string, orderedFeatureIds: string[]) => void;
  onRenameMilestone?: (milestoneId: string, newName: string) => void;
  onRenameFeature?: (featureId: string, newTitle: string) => void;
  onDurationChange?: (featureId: string, newDurationDays: number) => void;
  onAddTeamTrack?: (featureId: string, teamId: string) => void;
  onRemoveTeamTrack?: (featureId: string, teamId: string) => void;
  onDeleteFeature?: (featureId: string) => void;
}

interface Section {
  milestone: MilestoneOption;
  features: Feature[];
  completedCount: number;
  totalDuration: number;
  startDate?: Date;
  endDate?: Date;
}

interface PendingMove {
  featureId: string;
  featureTitle: string;
  targetProjectId: string;
  targetMilestoneName: string;
  brokenDeps: Array<{ predecessorId: string; successorId: string; predecessorTitle: string; successorTitle: string }>;
  bridgedDeps: Array<{ predecessorTitle: string; successorTitle: string }>;
  insertAtIndex?: number;
}

// Pointer-first collision so the drop point tracks the cursor tightly,
// not the center of the (tall) dragged row.
const pointerCollision: CollisionDetection = (args) => {
  const pointer = pointerWithin(args);
  if (pointer.length > 0) return pointer;
  return closestCenter(args);
};


function DroppableSection({
  milestoneId,
  activeProjectId,
  children,
}: {
  milestoneId: string;
  activeProjectId: string | null;
  children: (isValidDrop: boolean) => React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `drop-milestone-${milestoneId}`,
  });

  // Suppress highlight when dragging over the feature's own milestone
  const isValidDrop = isOver && activeProjectId !== milestoneId;

  return <div ref={setNodeRef}>{children(isValidDrop)}</div>;
}

export function FeaturesSectionList({
  features,
  milestones,
  dependencies = [],
  teamDurationsMap,
  allTeams,
  searchMatchIds,
  searchMatchMilestoneIds,
  onFeatureClick,
  onToggleComplete,
  onStatusChange,
  onPriorityChange,
  onAddFeature,
  onEditMilestone,
  onDeleteMilestone,
  onUpdateAppearance,
  onAddMilestone,
  onMoveFeature,
  onReorderFeatures,
  onRenameMilestone,
  onRenameFeature,
  onDurationChange,
  onAddTeamTrack,
  onRemoveTeamTrack,
  onDeleteFeature,
}: FeaturesSectionListProps) {
  const {
    collapsedSections,
    selectedIds,
    selectMode,
    toggleSection,
    toggleSelected,
    rangeSelect,
    clearSelection,
    selectIds,
    deselectIds,
  } = useFeaturesListStore();
  const durationUnit = useFeaturesListStore((s) => s.durationUnit);

  // Compute the longest formatted duration label for uniform column width
  const maxDurationLabel = useMemo(() => {
    let longest = "";
    for (const f of features) {
      const label = formatDurationIn(f.duration, durationUnit);
      if (label.length > longest.length) longest = label;
    }
    return longest;
  }, [features, durationUnit]);

  const lastClickedRef = useRef<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    milestoneId: string;
    insertIndex: number;
  } | null>(null);
  const pointerYRef = useRef(0);

  // Track pointer position during drag for accurate insertion detection
  useEffect(() => {
    if (!activeId) return;
    const handler = (e: PointerEvent) => { pointerYRef.current = e.clientY; };
    window.addEventListener("pointermove", handler);
    return () => window.removeEventListener("pointermove", handler);
  }, [activeId]);

  const { open: openContextMenu, menu: contextMenuEl } = useFeatureContextMenu({
    onOpen: (id) => {
      const feature = features.find((f) => f.id === id);
      if (feature) onFeatureClick(feature);
    },
    onStatusChange: (id, status) => onStatusChange?.(id, status),
    onPriorityChange: (id, priority) => onPriorityChange?.(id, priority),
    onDelete: (id) => onDeleteFeature?.(id),
  });

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    })
  );

  // Build a feature title lookup for dependency display
  const featureTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of features) {
      map.set(f.id, f.title);
    }
    return map;
  }, [features]);

  // Group features by projectId, sorted by dependency chain order within each section
  const sections = useMemo<Section[]>(() => {
    const byProject = new Map<string, Feature[]>();
    for (const f of features) {
      const arr = byProject.get(f.projectId) ?? [];
      arr.push(f);
      byProject.set(f.projectId, arr);
    }

    return milestones.map((m) => {
      const raw = byProject.get(m.id) ?? [];
      const sectionDeps = (dependencies || []).filter(
        (d) => raw.some((f) => f.id === d.predecessorId) && raw.some((f) => f.id === d.successorId)
      );
      const sectionFeatures = topoSortFeatures(raw, sectionDeps);
      let minStart: Date | undefined;
      let maxEnd: Date | undefined;
      for (const f of sectionFeatures) {
        const s = new Date(f.startDate);
        const e = new Date(f.endDate);
        if (!minStart || s < minStart) minStart = s;
        if (!maxEnd || e > maxEnd) maxEnd = e;
      }
      return {
        milestone: m,
        features: sectionFeatures,
        completedCount: sectionFeatures.filter(
          (f) => f.status === "completed"
        ).length,
        totalDuration: sectionFeatures.reduce(
          (sum, f) => sum + (f.duration || 0),
          0
        ),
        startDate: minStart,
        endDate: maxEnd,
      };
    });
  }, [features, milestones]);

  // Build a flat ordered list of feature IDs for shift-click range selection
  const flatFeatureIds = useMemo(() => {
    const ids: string[] = [];
    for (const section of sections) {
      if (!collapsedSections.has(section.milestone.id)) {
        for (const f of section.features) {
          ids.push(f.id);
        }
      }
    }
    return ids;
  }, [sections, collapsedSections]);

  // The projectId of the feature currently being dragged
  const activeProjectId = useMemo(() => {
    if (!activeId) return null;
    return features.find((f) => f.id === activeId)?.projectId ?? null;
  }, [activeId, features]);

  // Find the active feature for the drag overlay
  const activeFeature = useMemo(() => {
    if (!activeId) return null;
    return features.find((f) => f.id === activeId) ?? null;
  }, [activeId, features]);

  const handleSelect = useCallback(
    (featureId: string, e: React.MouseEvent) => {
      if (e.shiftKey && lastClickedRef.current) {
        const startIdx = flatFeatureIds.indexOf(lastClickedRef.current);
        const endIdx = flatFeatureIds.indexOf(featureId);
        if (startIdx !== -1 && endIdx !== -1) {
          const [from, to] =
            startIdx < endIdx
              ? [startIdx, endIdx]
              : [endIdx, startIdx];
          rangeSelect(flatFeatureIds.slice(from, to + 1));
          lastClickedRef.current = featureId;
          return;
        }
      }
      toggleSelected(featureId);
      lastClickedRef.current = featureId;
    },
    [flatFeatureIds, toggleSelected, rangeSelect]
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      setActiveId(event.active.id as string);
      if (selectMode) {
        clearSelection();
      }
    },
    [selectMode, clearSelection]
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { over } = event;
      if (!over || !activeProjectId) {
        setDropIndicator(null);
        return;
      }

      const overId = String(over.id);

      // Over a droppable section zone (header / empty area)
      if (overId.startsWith("drop-milestone-")) {
        const targetId = overId.replace("drop-milestone-", "");
        if (targetId !== activeProjectId) {
          const section = sections.find((s) => s.milestone.id === targetId);
          setDropIndicator({
            milestoneId: targetId,
            insertIndex: section?.features.length ?? 0,
          });
        } else {
          setDropIndicator(null);
        }
        return;
      }

      // Over a feature row
      const overFeature = features.find((f) => f.id === overId);
      if (!overFeature || overFeature.projectId === activeProjectId) {
        setDropIndicator(null);
        return;
      }

      // Cross-milestone hover — determine insertion index
      const section = sections.find((s) => s.milestone.id === overFeature.projectId);
      if (!section) { setDropIndicator(null); return; }

      const featureIndex = section.features.findIndex((f) => f.id === overId);

      // Use DOM rect for accurate top/bottom half detection
      const el = document.querySelector(`[data-feature-id="${overId}"]`);
      let insertIndex = featureIndex;
      if (el) {
        const rect = el.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        insertIndex = pointerYRef.current > midY ? featureIndex + 1 : featureIndex;
      }

      setDropIndicator({ milestoneId: overFeature.projectId, insertIndex });
    },
    [activeProjectId, features, sections]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const currentIndicator = dropIndicator;
      setActiveId(null);
      setDropIndicator(null);

      const { active, over } = event;
      if (!over) return;

      const overId = String(over.id);
      const draggedFeature = features.find((f) => f.id === active.id);
      if (!draggedFeature) return;

      // Determine if this is a cross-milestone drop
      let targetMilestoneId: string | null = null;

      if (overId.startsWith("drop-milestone-")) {
        targetMilestoneId = overId.replace("drop-milestone-", "");
      } else {
        const overFeature = features.find((f) => f.id === overId);
        if (overFeature && overFeature.projectId !== draggedFeature.projectId) {
          targetMilestoneId = overFeature.projectId;
        }
      }

      // --- Cross-milestone move ---
      if (targetMilestoneId && targetMilestoneId !== draggedFeature.projectId) {
        const targetMilestone = milestones.find((m) => m.id === targetMilestoneId);
        if (!targetMilestone) return;

        const insertAtIndex = currentIndicator?.milestoneId === targetMilestoneId
          ? currentIndicator.insertIndex
          : undefined;

        // Check if feature has dependencies
        const featureDeps = dependencies.filter(
          (d) =>
            d.predecessorId === draggedFeature.id ||
            d.successorId === draggedFeature.id
        );

        if (featureDeps.length > 0) {
          const predecessorIds = featureDeps
            .filter((d) => d.successorId === draggedFeature.id)
            .map((d) => d.predecessorId);
          const successorIds = featureDeps
            .filter((d) => d.predecessorId === draggedFeature.id)
            .map((d) => d.successorId);

          const brokenDeps = featureDeps.map((d) => ({
            predecessorId: d.predecessorId,
            successorId: d.successorId,
            predecessorTitle: featureTitleMap.get(d.predecessorId) ?? "Unknown",
            successorTitle: featureTitleMap.get(d.successorId) ?? "Unknown",
          }));

          const bridgedDeps: PendingMove["bridgedDeps"] = [];
          for (const predId of predecessorIds) {
            for (const succId of successorIds) {
              bridgedDeps.push({
                predecessorTitle: featureTitleMap.get(predId) ?? "Unknown",
                successorTitle: featureTitleMap.get(succId) ?? "Unknown",
              });
            }
          }

          setPendingMove({
            featureId: draggedFeature.id,
            featureTitle: draggedFeature.title,
            targetProjectId: targetMilestoneId,
            targetMilestoneName: targetMilestone.name,
            brokenDeps,
            bridgedDeps,
            insertAtIndex,
          });
        } else {
          onMoveFeature?.(draggedFeature.id, targetMilestoneId, insertAtIndex);
        }
        return;
      }

      // --- Within-section reorder (dropped on another feature) ---
      const overFeature = features.find((f) => f.id === overId);
      if (!overFeature) return;

      // Only reorder within the same milestone
      if (draggedFeature.projectId !== overFeature.projectId) return;

      // Same position — no-op
      if (active.id === over.id) return;

      const section = sections.find(
        (s) => s.milestone.id === draggedFeature.projectId
      );
      if (!section || section.features.length < 2) return;

      const currentIds = section.features.map((f) => f.id);
      const oldIndex = currentIds.indexOf(String(active.id));
      const newIndex = currentIds.indexOf(overId);

      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

      const newOrder = arrayMove(currentIds, oldIndex, newIndex);
      onReorderFeatures?.(draggedFeature.projectId, newOrder);
    },
    [features, milestones, dependencies, featureTitleMap, onMoveFeature, onReorderFeatures, sections, dropIndicator]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setDropIndicator(null);
  }, []);

  const confirmMove = useCallback(() => {
    if (pendingMove) {
      onMoveFeature?.(pendingMove.featureId, pendingMove.targetProjectId, pendingMove.insertAtIndex);
      setPendingMove(null);
    }
  }, [pendingMove, onMoveFeature]);

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerCollision}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="space-y-3">
          {sections.map((section) => {
            const isCollapsed = collapsedSections.has(section.milestone.id);
            const isSectionDimmed = searchMatchMilestoneIds != null && !searchMatchMilestoneIds.has(section.milestone.id);
            return (
              <DroppableSection
                key={section.milestone.id}
                milestoneId={section.milestone.id}
                activeProjectId={activeProjectId}
              >
                {(isOver) => (
                  <div
                    className="rounded-xl border bg-background overflow-hidden transition-opacity duration-200"
                    style={{ opacity: isSectionDimmed ? 0.4 : 1 }}
                  >
                    <SectionHeader
                      milestoneId={section.milestone.id}
                      name={section.milestone.name}
                      color={section.milestone.color}
                      icon={section.milestone.icon}
                      featureCount={section.features.length}
                      completedCount={section.completedCount}
                      totalDuration={section.totalDuration}
                      startDate={section.startDate}
                      endDate={section.endDate}
                      collapsed={isCollapsed}
                      isDropTarget={isOver}
                      onToggle={() => toggleSection(section.milestone.id)}
                      onAddFeature={(e) => onAddFeature?.(section.milestone.id, e)}
                      onEditMilestone={() => onEditMilestone?.(section.milestone.id)}
                      onDeleteMilestone={() => onDeleteMilestone?.(section.milestone.id)}
                      onUpdateAppearance={(data) => onUpdateAppearance?.(section.milestone.id, data)}
                      onRename={(newName) => onRenameMilestone?.(section.milestone.id, newName)}
                      onSelectAll={() => selectIds(section.features.map((f) => f.id))}
                      onDeselectAll={() => deselectIds(section.features.map((f) => f.id))}
                      hasSelectedFeatures={section.features.some((f) => selectedIds.has(f.id))}
                    />

                    {/* Animated collapse container */}
                    <div
                      className="grid transition-[grid-template-rows] duration-200 ease-in-out"
                      style={{
                        gridTemplateRows: isCollapsed ? "0fr" : "1fr",
                      }}
                    >
                      <div className="overflow-hidden">
                        {section.features.length === 0 ? (
                          <button
                            onClick={(e) => onAddFeature?.(section.milestone.id, e)}
                            className="w-full px-3 py-3 flex items-center gap-2 text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/30 transition-colors cursor-pointer"
                          >
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                              <Plus className="h-3.5 w-3.5" />
                            </div>
                            <span className="text-sm">Add a feature</span>
                          </button>
                        ) : (
                          <>
                            <SortableContext
                              items={section.features.map((f) => f.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              {section.features.map((feature, featureIndex) => (
                                <div key={feature.id}>
                                  {dropIndicator?.milestoneId === section.milestone.id &&
                                    dropIndicator.insertIndex === featureIndex && (
                                    <div className="relative h-0.5 mx-3">
                                      <div className="absolute inset-x-0 top-0 h-0.5 rounded-full bg-primary" />
                                      <div className="absolute -left-0.5 -top-[3px] h-2 w-2 rounded-full bg-primary" />
                                    </div>
                                  )}
                                  <SortableFeatureRow
                                    id={feature.id}
                                    title={feature.title}
                                    status={feature.status}
                                    priority={feature.priority}
                                    duration={feature.duration}
                                    startDate={feature.startDate}
                                    endDate={feature.endDate}
                                    teamDurations={teamDurationsMap?.get(feature.id)}
                                    allTeams={allTeams}
                                    selected={selectedIds.has(feature.id)}
                                    selectMode={selectMode}
                                    isAnyDragging={!!activeId}
                                    dimmed={searchMatchIds != null && !searchMatchIds.has(feature.id)}
                                    onSelect={(e) => handleSelect(feature.id, e)}
                                    onClick={() => onFeatureClick(feature)}
                                    onToggleComplete={() => onToggleComplete?.(feature.id, feature.status)}
                                    onStatusChange={(newStatus) => onStatusChange?.(feature.id, newStatus)}
                                    onPriorityChange={(newPriority) => onPriorityChange?.(feature.id, newPriority)}
                                    onRename={(newTitle) => onRenameFeature?.(feature.id, newTitle)}
                                    onDurationChange={(days) => onDurationChange?.(feature.id, days)}
                                    maxDurationLabel={maxDurationLabel}
                                    onAddTeamTrack={(teamId) => onAddTeamTrack?.(feature.id, teamId)}
                                    onRemoveTeamTrack={(teamId) => onRemoveTeamTrack?.(feature.id, teamId)}
                                    onContextMenu={(e) => openContextMenu({
                                      featureId: feature.id,
                                      status: feature.status,
                                      priority: feature.priority,
                                    }, e)}
                                  />
                                </div>
                              ))}
                              {/* Drop indicator at end of list */}
                              {dropIndicator?.milestoneId === section.milestone.id &&
                                dropIndicator.insertIndex === section.features.length && (
                                <div className="relative h-0.5 mx-3">
                                  <div className="absolute inset-x-0 top-0 h-0.5 rounded-full bg-primary" />
                                  <div className="absolute -left-0.5 -top-[3px] h-2 w-2 rounded-full bg-primary" />
                                </div>
                              )}
                            </SortableContext>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </DroppableSection>
            );
          })}

          {/* Ghost section — add new milestone */}
          {onAddMilestone && (
            <button
              onClick={onAddMilestone}
              className="w-full rounded-xl border border-dashed border-border/60 px-4 py-3 flex items-center gap-3 text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/30 transition-colors"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
                <Plus className="h-4 w-4" />
              </div>
              <span className="text-sm">New milestone</span>
            </button>
          )}
          <div className="h-24" aria-hidden />
        </div>

        <DragOverlay dropAnimation={null}>
          {activeFeature ? (
            <div className="flex items-center gap-2 px-4 py-3.5 max-w-xs bg-background border rounded-lg shadow-lg cursor-grabbing">
              <span className="truncate text-sm">{activeFeature.title}</span>
              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground tabular-nums">
                {formatDuration(activeFeature.duration)}
              </span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {contextMenuEl}

      <AlertDialog
        open={!!pendingMove}
        onOpenChange={(open) => {
          if (!open) setPendingMove(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move feature with dependencies?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Moving &quot;{pendingMove?.featureTitle}&quot; to{" "}
                  <strong>{pendingMove?.targetMilestoneName}</strong> will break
                  its dependency connections.
                </p>
                {pendingMove && pendingMove.brokenDeps.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">
                      Dependencies that will be removed:
                    </p>
                    <ul className="text-sm list-disc pl-5 space-y-0.5">
                      {pendingMove.brokenDeps.map((d, i) => (
                        <li key={i}>
                          {d.predecessorTitle} → {d.successorTitle}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {pendingMove &&
                  pendingMove.bridgedDeps.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-foreground mb-1">
                        Dependencies that will be bridged:
                      </p>
                      <ul className="text-sm list-disc pl-5 space-y-0.5">
                        {pendingMove.bridgedDeps.map((d, i) => (
                          <li key={i}>
                            {d.predecessorTitle} → {d.successorTitle}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmMove}>
              Move feature
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
