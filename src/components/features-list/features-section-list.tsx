"use client";

import { useMemo, useRef, useCallback, useState, useEffect } from "react";
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
import { SectionHeader } from "./section-header";
import { FeatureRow, type TeamDurationInfo, type TeamOption } from "./feature-row";
import { InlineCreateRow } from "./inline-create-row";
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

const FEATURE_ROW_HEIGHT = 44; // h-11
const DRAG_ACTIVATION_DISTANCE = 8;

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
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);

  // Inline quick-create state: which milestone has an active inline row
  const [inlineCreateMilestoneId, setInlineCreateMilestoneId] = useState<string | null>(null);

  // --- Pointer-based drag state ---
  const [dragState, setDragState] = useState<{
    featureId: string;
    sourceMilestoneId: string;
    sourceIndex: number;
    targetMilestoneId: string;
    targetIndex: number;
  } | null>(null);
  const dragStateRef = useRef(dragState);
  dragStateRef.current = dragState;
  const isDragging = !!dragState;

  // Suppress click after drag completes
  const dragJustEndedRef = useRef(false);

  // Section feature-list refs for position calculation
  const sectionListRefs = useRef(new Map<string, HTMLDivElement>());

  const { open: openContextMenu, menu: contextMenuEl } = useFeatureContextMenu({
    onOpen: (id) => {
      const feature = features.find((f) => f.id === id);
      if (feature) onFeatureClick(feature);
    },
    onStatusChange: (id, status) => onStatusChange?.(id, status),
    onPriorityChange: (id, priority) => onPriorityChange?.(id, priority),
    onDelete: (id) => onDeleteFeature?.(id),
  });

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

  // Hotkey: F then 1-9 opens inline create for that milestone
  const fPressedRef = useRef(false);
  const fTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === "f" && !e.shiftKey) {
        fPressedRef.current = true;
        if (fTimerRef.current) clearTimeout(fTimerRef.current);
        fTimerRef.current = setTimeout(() => { fPressedRef.current = false; }, 800);
        return;
      }

      if (fPressedRef.current && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        fPressedRef.current = false;
        if (fTimerRef.current) clearTimeout(fTimerRef.current);

        const index = parseInt(e.key, 10) - 1;
        if (index < sections.length) {
          const milestoneId = sections[index].milestone.id;
          setInlineCreateMilestoneId(milestoneId);
          if (collapsedSections.has(milestoneId)) {
            toggleSection(milestoneId);
          }
        }
        return;
      }

      if (fPressedRef.current && e.key !== "f") {
        fPressedRef.current = false;
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      if (fTimerRef.current) clearTimeout(fTimerRef.current);
    };
  }, [sections, collapsedSections, toggleSection]);

  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;

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

  const handleSelect = useCallback(
    (featureId: string, e: React.MouseEvent) => {
      // Only range-select if the anchor is still selected (not stale from a cleared selection)
      if (e.shiftKey && lastClickedRef.current && selectedIds.has(lastClickedRef.current)) {
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
    [flatFeatureIds, selectedIds, toggleSelected, rangeSelect]
  );

  // --- Pointer-based drag handler ---
  const handleRowPointerDown = useCallback(
    (featureId: string, milestoneId: string, featureIndex: number, e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;

      const isTouch = e.pointerType === 'touch';
      const startX = e.clientX;
      const startY = e.clientY;
      let activated = false;
      let longPressReady = !isTouch;
      let longPressTimer: ReturnType<typeof setTimeout> | null = null;

      const activate = () => {
        activated = true;
        setDragState({
          featureId,
          sourceMilestoneId: milestoneId,
          sourceIndex: featureIndex,
          targetMilestoneId: milestoneId,
          targetIndex: featureIndex,
        });
        if (selectMode) clearSelection();
      };

      if (isTouch) {
        longPressTimer = setTimeout(() => {
          longPressReady = true;
          longPressTimer = null;
        }, 250);
      }

      const cleanup = () => {
        document.removeEventListener('pointermove', handleMove);
        document.removeEventListener('pointerup', handleUp);
        document.removeEventListener('contextmenu', handleContextMenu);
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      };

      const handleContextMenu = (ev: Event) => {
        if (activated) {
          ev.preventDefault();
          cleanup();
          setDragState(null);
        }
      };

      const handleMove = (ev: PointerEvent) => {
        const dist = Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY);

        if (isTouch && !longPressReady) {
          if (dist > 5) cleanup();
          return;
        }

        if (!activated) {
          if (dist < DRAG_ACTIVATION_DISTANCE) return;
          activate();
        }

        // Find which section the cursor is in
        for (const [mId, el] of sectionListRefs.current) {
          const rect = el.getBoundingClientRect();
          if (ev.clientY >= rect.top && ev.clientY <= rect.bottom) {
            const section = sectionsRef.current.find(s => s.milestone.id === mId);
            if (!section) continue;
            const relY = ev.clientY - rect.top;
            const maxIdx = section.features.length;
            const target = Math.max(0, Math.min(maxIdx, Math.round(relY / FEATURE_ROW_HEIGHT)));
            setDragState(prev => prev ? {
              ...prev,
              targetMilestoneId: mId,
              targetIndex: target,
            } : null);
            return;
          }
        }
      };

      const handleUp = () => {
        cleanup();
        if (!activated) return;

        // Suppress the click that follows pointerup
        dragJustEndedRef.current = true;
        requestAnimationFrame(() => { dragJustEndedRef.current = false; });

        const state = dragStateRef.current;
        setDragState(null);
        if (!state) return;

        const { featureId: draggedId, sourceMilestoneId: srcMId, sourceIndex: srcIdx, targetMilestoneId: tgtMId, targetIndex: tgtIdx } = state;

        if (srcMId === tgtMId) {
          // --- Within-section reorder ---
          const adjustedTarget = tgtIdx > srcIdx ? tgtIdx - 1 : tgtIdx;
          if (adjustedTarget === srcIdx) return;
          const section = sectionsRef.current.find(s => s.milestone.id === srcMId);
          if (!section || section.features.length < 2) return;
          const currentIds = section.features.map(f => f.id);
          const newOrder = [...currentIds];
          const [moved] = newOrder.splice(srcIdx, 1);
          newOrder.splice(adjustedTarget, 0, moved);
          onReorderFeatures?.(srcMId, newOrder);
        } else {
          // --- Cross-milestone move ---
          const draggedFeature = features.find(f => f.id === draggedId);
          if (!draggedFeature) return;
          const targetMilestone = milestones.find(m => m.id === tgtMId);
          if (!targetMilestone) return;

          const featureDeps = dependencies.filter(
            d => d.predecessorId === draggedId || d.successorId === draggedId
          );

          if (featureDeps.length > 0) {
            const predecessorIds = featureDeps.filter(d => d.successorId === draggedId).map(d => d.predecessorId);
            const successorIds = featureDeps.filter(d => d.predecessorId === draggedId).map(d => d.successorId);
            const brokenDeps = featureDeps.map(d => ({
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
              featureId: draggedId,
              featureTitle: draggedFeature.title,
              targetProjectId: tgtMId,
              targetMilestoneName: targetMilestone.name,
              brokenDeps,
              bridgedDeps,
              insertAtIndex: tgtIdx,
            });
          } else {
            onMoveFeature?.(draggedId, tgtMId, tgtIdx);
          }
        }
      };

      document.addEventListener('pointermove', handleMove);
      document.addEventListener('pointerup', handleUp);
      document.addEventListener('contextmenu', handleContextMenu);
    },
    [selectMode, clearSelection, features, milestones, dependencies, featureTitleMap, onMoveFeature, onReorderFeatures]
  );

  const confirmMove = useCallback(() => {
    if (pendingMove) {
      onMoveFeature?.(pendingMove.featureId, pendingMove.targetProjectId, pendingMove.insertAtIndex);
      setPendingMove(null);
    }
  }, [pendingMove, onMoveFeature]);

  // Compute insertion line position
  const insertionLine = useMemo(() => {
    if (!dragState) return null;
    const { sourceMilestoneId, sourceIndex, targetMilestoneId, targetIndex } = dragState;
    const isSameSection = sourceMilestoneId === targetMilestoneId;
    // Suppress line when it would be a no-op
    if (isSameSection && (targetIndex === sourceIndex || targetIndex === sourceIndex + 1)) return null;
    return { milestoneId: targetMilestoneId, index: targetIndex };
  }, [dragState]);

  return (
    <>
      <div className="space-y-3">
        {sections.map((section) => {
          const isCollapsed = collapsedSections.has(section.milestone.id);
          const isSectionDimmed = searchMatchMilestoneIds != null && !searchMatchMilestoneIds.has(section.milestone.id);
          const isDropTarget = isDragging && dragState.sourceMilestoneId !== section.milestone.id && dragState.targetMilestoneId === section.milestone.id;
          return (
            <div
              key={section.milestone.id}
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
                isDropTarget={isDropTarget}
                onToggle={() => toggleSection(section.milestone.id)}
                onAddFeature={(e) => {
                  if (e?.shiftKey) {
                    // Shift+click: open full dialog
                    onAddFeature?.(section.milestone.id, e);
                  } else {
                    // Normal click: toggle inline quick-create
                    setInlineCreateMilestoneId((prev) =>
                      prev === section.milestone.id ? null : section.milestone.id
                    );
                  }
                }}
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
                  {section.features.length === 0 && inlineCreateMilestoneId !== section.milestone.id ? (
                    <button
                      onClick={() => setInlineCreateMilestoneId(section.milestone.id)}
                      className="w-full px-3 py-3 flex items-center gap-2 text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/30 transition-colors cursor-pointer"
                    >
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                        <Plus className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-sm">Add a feature</span>
                    </button>
                  ) : (
                    <div
                      ref={(el) => {
                        if (el) sectionListRefs.current.set(section.milestone.id, el);
                        else sectionListRefs.current.delete(section.milestone.id);
                      }}
                      className="relative"
                    >
                      {section.features.map((feature, featureIndex) => (
                        <div
                          key={feature.id}
                          onPointerDown={!selectMode ? (e) => {
                            if (e.pointerType === 'touch') return;
                            handleRowPointerDown(feature.id, section.milestone.id, featureIndex, e);
                          } : undefined}
                          onClickCapture={(e) => {
                            if (dragJustEndedRef.current) {
                              e.stopPropagation();
                              e.preventDefault();
                            }
                          }}
                        >
                          <FeatureRow
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
                            isAnyDragging={isDragging}
                            isDragging={dragState?.featureId === feature.id}
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

                      {/* Insertion line indicator */}
                      {insertionLine?.milestoneId === section.milestone.id && (
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            top: insertionLine.index * FEATURE_ROW_HEIGHT,
                            zIndex: 20,
                            pointerEvents: 'none',
                            transform: 'translateY(-50%)',
                          }}
                        >
                          <div className="relative h-0.5 bg-primary rounded-full mx-3">
                            <div className="absolute -left-0.5 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary" />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Inline quick-create row */}
                  {inlineCreateMilestoneId === section.milestone.id && (
                    <InlineCreateRow
                      milestoneId={section.milestone.id}
                      lastFeature={
                        section.features.length > 0
                          ? {
                              id: section.features[section.features.length - 1].id,
                              endDate: section.features[section.features.length - 1].endDate,
                            }
                          : null
                      }
                      onClose={() => setInlineCreateMilestoneId(null)}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Ghost section — add new milestone */}
        {onAddMilestone && (
          <button
            onClick={onAddMilestone}
            className="w-full rounded-xl border border-dashed border-border/60 px-3 py-3 flex items-center gap-1.5 text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/30 transition-colors"
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded">
              <Plus className="h-4 w-4" />
            </div>
            <span className="text-sm">New milestone</span>
            <div className="ml-auto shrink-0 w-6 hidden md:flex items-center justify-center">
              <kbd className="text-[11px] font-mono text-muted-foreground/40">M</kbd>
            </div>
          </button>
        )}
        <div className="h-24" aria-hidden />
      </div>

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
