"use client";

import { useMemo, useRef, useCallback, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  closestCenter,
  useSensor,
  useSensors,
  useDroppable,
  type CollisionDetection,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { Plus, GripVertical } from "lucide-react";
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
import { SortableFeatureRow, type TeamDurationInfo } from "./feature-row";

interface Feature {
  id: string;
  projectId: string;
  title: string;
  startDate: Date | string;
  endDate: Date | string;
  status: string;
  priority: string;
  duration: number;
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
  onFeatureClick: (feature: any) => void;
  onToggleComplete?: (featureId: string, currentStatus: string) => void;
  onStatusChange?: (featureId: string, newStatus: string) => void;
  onAddFeature?: (milestoneId: string, e?: React.MouseEvent) => void;
  onEditMilestone?: (milestoneId: string) => void;
  onDeleteMilestone?: (milestoneId: string) => void;
  onUpdateAppearance?: (milestoneId: string, data: { color: string; icon: string }) => void;
  onAddMilestone?: () => void;
  onMoveFeature?: (featureId: string, targetProjectId: string) => void;
  onReorderFeatures?: (projectId: string, orderedFeatureIds: string[]) => void;
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
  onFeatureClick,
  onToggleComplete,
  onStatusChange,
  onAddFeature,
  onEditMilestone,
  onDeleteMilestone,
  onUpdateAppearance,
  onAddMilestone,
  onMoveFeature,
  onReorderFeatures,
}: FeaturesSectionListProps) {
  const {
    collapsedSections,
    selectedIds,
    selectMode,
    toggleSection,
    toggleSelected,
    rangeSelect,
    clearSelection,
  } = useFeaturesListStore();

  const lastClickedRef = useRef<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
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

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);

      const { active, over } = event;
      if (!over) return;

      const overId = String(over.id);
      const draggedFeature = features.find((f) => f.id === active.id);
      if (!draggedFeature) return;

      // --- Cross-milestone drop (onto a droppable section zone) ---
      if (overId.startsWith("drop-milestone-")) {
        const targetMilestoneId = overId.replace("drop-milestone-", "");

        // Same milestone — no-op
        if (draggedFeature.projectId === targetMilestoneId) return;

        const targetMilestone = milestones.find((m) => m.id === targetMilestoneId);
        if (!targetMilestone) return;

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
          });
        } else {
          onMoveFeature?.(draggedFeature.id, targetMilestoneId);
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
    [features, milestones, dependencies, featureTitleMap, onMoveFeature, onReorderFeatures, sections]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const confirmMove = useCallback(() => {
    if (pendingMove) {
      onMoveFeature?.(pendingMove.featureId, pendingMove.targetProjectId);
      setPendingMove(null);
    }
  }, [pendingMove, onMoveFeature]);

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerCollision}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="space-y-4">
          {sections.map((section) => {
            const isCollapsed = collapsedSections.has(section.milestone.id);
            return (
              <DroppableSection
                key={section.milestone.id}
                milestoneId={section.milestone.id}
                activeProjectId={activeProjectId}
              >
                {(isOver) => (
                  <div
                    className="rounded-2xl overflow-hidden border transition-shadow"
                    style={
                      isOver
                        ? { boxShadow: "0 0 0 2px hsl(var(--primary) / 0.3)" }
                        : undefined
                    }
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
                            className="w-full px-4 py-3.5 flex items-center gap-3 text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors cursor-pointer"
                          >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                              <Plus className="h-4 w-4" />
                            </div>
                            <span className="text-sm">Add a feature</span>
                          </button>
                        ) : (
                          <SortableContext
                            items={section.features.map((f) => f.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            {section.features.map((feature) => (
                              <SortableFeatureRow
                                key={feature.id}
                                id={feature.id}
                                title={feature.title}
                                status={feature.status}
                                priority={feature.priority}
                                duration={feature.duration}
                                startDate={feature.startDate}
                                endDate={feature.endDate}
                                teamDurations={teamDurationsMap?.get(feature.id)}
                                selected={selectedIds.has(feature.id)}
                                selectMode={selectMode}
                                isAnyDragging={!!activeId}
                                onSelect={(e) => handleSelect(feature.id, e)}
                                onClick={() => onFeatureClick(feature)}
                                onToggleComplete={() => onToggleComplete?.(feature.id, feature.status)}
                                onStatusChange={(newStatus) => onStatusChange?.(feature.id, newStatus)}
                              />
                            ))}
                          </SortableContext>
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
              className="w-full rounded-2xl border border-dashed border-border px-4 py-3 flex items-center gap-3 text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-accent/20 transition-colors"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Plus className="h-4 w-4" />
              </div>
              <span className="text-sm">New milestone</span>
            </button>
          )}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeFeature ? (
            <div className="flex items-center gap-2 px-4 py-3.5 max-w-xs bg-background border rounded-lg shadow-lg cursor-grabbing">
              <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
              <span className="truncate text-sm">{activeFeature.title}</span>
              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground tabular-nums">
                {formatDuration(activeFeature.duration)}
              </span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

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
