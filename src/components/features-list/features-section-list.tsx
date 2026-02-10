"use client";

import { useMemo, useRef, useCallback, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { useFeaturesListStore } from "@/store/features-list-store";
import { SectionHeader } from "./section-header";
import { FeatureRow, SortableFeatureRow } from "./feature-row";

interface Feature {
  id: string;
  projectId: string;
  title: string;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface FeaturesSectionListProps {
  features: Feature[];
  milestones: MilestoneOption[];
  onFeatureClick: (feature: any) => void;
  onReorder?: (args: {
    projectId: string;
    items: Array<{ id: string; sortOrder: number }>;
  }) => void;
}

interface Section {
  milestone: MilestoneOption;
  features: Feature[];
  completedCount: number;
}

export function FeaturesSectionList({
  features,
  milestones,
  onFeatureClick,
  onReorder,
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Group features by projectId, ordered by milestones array order
  const sections = useMemo<Section[]>(() => {
    const byProject = new Map<string, Feature[]>();
    for (const f of features) {
      const arr = byProject.get(f.projectId) ?? [];
      arr.push(f);
      byProject.set(f.projectId, arr);
    }

    return milestones
      .filter((m) => byProject.has(m.id))
      .map((m) => {
        const sectionFeatures = byProject.get(m.id)!;
        return {
          milestone: m,
          features: sectionFeatures,
          completedCount: sectionFeatures.filter(
            (f) => f.status === "completed"
          ).length,
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
      // Clear selection when drag starts to avoid confusing UX
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
      if (!over || active.id === over.id) return;

      // Find which section both items belong to
      const activeFeature = features.find((f) => f.id === active.id);
      const overFeature = features.find((f) => f.id === over.id);
      if (!activeFeature || !overFeature) return;

      // Only allow reorder within the same section
      if (activeFeature.projectId !== overFeature.projectId) return;

      const section = sections.find(
        (s) => s.milestone.id === activeFeature.projectId
      );
      if (!section) return;

      const sectionFeatures = section.features;
      const oldIndex = sectionFeatures.findIndex((f) => f.id === active.id);
      const newIndex = sectionFeatures.findIndex((f) => f.id === over.id);

      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

      const reordered = arrayMove(sectionFeatures, oldIndex, newIndex);
      const items = reordered.map((f, index) => ({
        id: f.id,
        sortOrder: index,
      }));

      onReorder?.({ projectId: activeFeature.projectId, items });
    },
    [features, sections, onReorder]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="space-y-4">
        {sections.map((section) => {
          const isCollapsed = collapsedSections.has(section.milestone.id);
          const featureIds = section.features.map((f) => f.id);
          return (
            <div
              key={section.milestone.id}
              className="rounded-2xl overflow-hidden border"
            >
              <SectionHeader
                milestoneId={section.milestone.id}
                name={section.milestone.name}
                color={section.milestone.color}
                icon={section.milestone.icon}
                featureCount={section.features.length}
                completedCount={section.completedCount}
                collapsed={isCollapsed}
                onToggle={() => toggleSection(section.milestone.id)}
              />

              {/* Animated collapse container */}
              <div
                className="grid transition-[grid-template-rows] duration-200 ease-in-out"
                style={{
                  gridTemplateRows: isCollapsed ? "0fr" : "1fr",
                }}
              >
                <div className="overflow-hidden">
                  <SortableContext
                    items={featureIds}
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
                        selected={selectedIds.has(feature.id)}
                        selectMode={selectMode}
                        onSelect={(e) => handleSelect(feature.id, e)}
                        onClick={() => onFeatureClick(feature)}
                      />
                    ))}
                  </SortableContext>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <DragOverlay>
        {activeFeature ? (
          <FeatureRow
            id={activeFeature.id}
            title={activeFeature.title}
            status={activeFeature.status}
            priority={activeFeature.priority}
            duration={activeFeature.duration}
            selected={false}
            selectMode={false}
            isOverlay
            onSelect={() => {}}
            onClick={() => {}}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
