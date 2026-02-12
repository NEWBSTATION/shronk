"use client";

import { useMemo, useRef, useCallback, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
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
import { SectionHeader } from "./section-header";
import { FeatureRow, DraggableFeatureRow, type TeamDurationInfo } from "./feature-row";

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
  onAddFeature?: (milestoneId: string) => void;
  onEditMilestone?: (milestoneId: string) => void;
  onDeleteMilestone?: (milestoneId: string) => void;
  onUpdateAppearance?: (milestoneId: string, data: { color: string; icon: string }) => void;
  onAddMilestone?: () => void;
  onMoveFeature?: (featureId: string, targetProjectId: string) => void;
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

  // Group features by projectId, sorted by startDate within each section
  const sections = useMemo<Section[]>(() => {
    const byProject = new Map<string, Feature[]>();
    for (const f of features) {
      const arr = byProject.get(f.projectId) ?? [];
      arr.push(f);
      byProject.set(f.projectId, arr);
    }

    return milestones.map((m) => {
      const sectionFeatures = (byProject.get(m.id) ?? []).slice().sort((a, b) => {
        const aDate = new Date(a.startDate).getTime();
        const bDate = new Date(b.startDate).getTime();
        return aDate - bDate;
      });
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

      // Extract milestone id from droppable zone id
      const overId = String(over.id);
      if (!overId.startsWith("drop-milestone-")) return;

      const targetMilestoneId = overId.replace("drop-milestone-", "");
      const draggedFeature = features.find((f) => f.id === active.id);
      if (!draggedFeature) return;

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
        // Build broken/bridged info for the dialog
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
        // No deps — move immediately
        onMoveFeature?.(draggedFeature.id, targetMilestoneId);
      }
    },
    [features, milestones, dependencies, featureTitleMap, onMoveFeature]
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
                      onAddFeature={() => onAddFeature?.(section.milestone.id)}
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
                            onClick={() => onAddFeature?.(section.milestone.id)}
                            className="w-full px-4 py-3.5 flex items-center gap-3 text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors cursor-pointer"
                          >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                              <Plus className="h-4 w-4" />
                            </div>
                            <span className="text-sm">Add a feature</span>
                          </button>
                        ) : (
                          section.features.map((feature) => (
                            <DraggableFeatureRow
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
                              onSelect={(e) => handleSelect(feature.id, e)}
                              onClick={() => onFeatureClick(feature)}
                              onToggleComplete={() => onToggleComplete?.(feature.id, feature.status)}
                              onStatusChange={(newStatus) => onStatusChange?.(feature.id, newStatus)}
                            />
                          ))
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

        <DragOverlay>
          {activeFeature ? (
            <FeatureRow
              id={activeFeature.id}
              title={activeFeature.title}
              status={activeFeature.status}
              priority={activeFeature.priority}
              duration={activeFeature.duration}
              startDate={activeFeature.startDate}
              endDate={activeFeature.endDate}
              teamDurations={teamDurationsMap?.get(activeFeature.id)}
              selected={false}
              selectMode={false}
              isOverlay
              onSelect={() => {}}
              onClick={() => {}}
            />
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
