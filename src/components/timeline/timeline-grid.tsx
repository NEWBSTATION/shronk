'use client';

import { type RefObject, useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { Link2, Plus, GripVertical, ChevronDown, Pencil } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ROW_HEIGHT, SCALE_HEIGHT } from './scales-config';
import { MilestoneIcon } from '@/lib/milestone-icon';
import { getColorStyles } from '@/lib/milestone-theme';
import type { SVARTask } from './types';
import type { Milestone, MilestoneStatus, Project } from '@/db/schema';

const ADD_FEATURE_TASK_ID = '__add_feature__';
const DRAG_ACTIVATION_DISTANCE = 5;

/** Circle-check toggle matching the FeatureRow Material Design icons */
function StatusToggle({
  id,
  status,
  onToggle,
}: {
  id: string;
  status: string;
  onToggle: RefObject<(id: string, status: MilestoneStatus) => Promise<void>>;
}) {
  const isComplete = status === 'completed';
  return (
    <button
      className={`shrink-0 flex items-center justify-center transition-colors ${
        isComplete
          ? 'text-green-500 hover:text-green-600'
          : 'text-muted-foreground/40 hover:text-muted-foreground/70'
      }`}
      onClick={(e) => {
        e.stopPropagation();
        onToggle.current(id, isComplete ? 'not_started' : 'completed');
      }}
      title={isComplete ? 'Mark incomplete' : 'Mark complete'}
    >
      {isComplete ? (
        <svg className="h-5 w-5" viewBox="0 -960 960 960" fill="currentColor">
          <path d="m429-336 238-237-51-51-187 186-85-84-51 51 136 135Zm51 240q-79 0-149-30t-122.5-82.5Q156-261 126-331T96-480q0-80 30-149.5t82.5-122Q261-804 331-834t149-30q80 0 149.5 30t122 82.5Q804-699 834-629.5T864-480q0 79-30 149t-82.5 122.5Q699-156 629.5-126T480-96Z" />
        </svg>
      ) : (
        <svg className="h-5 w-5" viewBox="0 -960 960 960" fill="currentColor">
          <path d="m429-336 238-237-51-51-187 186-85-84-51 51 136 135Zm51 240q-79 0-149-30t-122.5-82.5Q156-261 126-331T96-480q0-80 30-149.5t82.5-122Q261-804 331-834t149-30q80 0 149.5 30t122 82.5Q804-699 834-629.5T864-480q0 79-30 149t-82.5 122.5Q699-156 629.5-126T480-96Zm0-72q130 0 221-91t91-221q0-130-91-221t-221-91q-130 0-221 91t-91 221q0 130 91 221t221 91Zm0-312Z" />
        </svg>
      )}
    </button>
  );
}

interface TimelineGridProps {
  tasks: SVARTask[];
  features: Milestone[];
  width: number;
  scrollRef: RefObject<HTMLDivElement | null>;
  onRowClick: (task: SVARTask) => void;
  onStatusChange: RefObject<(id: string, status: MilestoneStatus) => Promise<void>>;
  onAddFeature: (opts?: { chain?: boolean }) => void;
  onReorder?: (orderedFeatureIds: string[]) => void;
  onDragActiveChange?: (isDragging: boolean) => void;
  project: Project;
  allProjects?: Project[];
  onProjectChange?: (id: string) => void;
  onMilestoneClick?: (project: Project) => void;
  onAddMilestone?: () => void;
}

export function TimelineGrid({
  tasks,
  features,
  width,
  scrollRef,
  onRowClick,
  onStatusChange,
  onAddFeature,
  onReorder,
  onDragActiveChange,
  project,
  allProjects,
  onProjectChange,
  onMilestoneClick,
  onAddMilestone,
}: TimelineGridProps) {

  // Feature IDs (excludes team tracks and sentinel)
  const featureIds = useMemo(
    () => features.map((f) => f.id),
    [features]
  );
  const featureIdSet = useMemo(() => new Set(featureIds), [featureIds]);

  // --- Manual drag state ---
  const [dragState, setDragState] = useState<{
    featureId: string;
    sourceIndex: number;
    targetIndex: number;
  } | null>(null);

  const innerRef = useRef<HTMLDivElement>(null);
  const targetIndexRef = useRef(-1);
  const featureIdsRef = useRef(featureIds);
  featureIdsRef.current = featureIds;

  const isDragging = !!dragState;
  const activeId = dragState?.featureId ?? null;

  // Compute insertion line Y position
  const insertLineY = useMemo(() => {
    if (!dragState || dragState.sourceIndex === dragState.targetIndex) return null;
    const { sourceIndex, targetIndex } = dragState;
    if (targetIndex < sourceIndex) {
      return targetIndex * ROW_HEIGHT; // top edge of target row
    }
    return (targetIndex + 1) * ROW_HEIGHT; // bottom edge of target row
  }, [dragState]);

  // Suppress click after drag completes
  const dragJustEndedRef = useRef(false);

  // Pointer-based drag initiation — works from anywhere on the row
  const handleGripPointerDown = useCallback(
    (featureId: string, e: React.PointerEvent) => {
      // Don't hijack clicks on the status toggle
      if ((e.target as HTMLElement).closest('button')) return;

      const idx = featureIdsRef.current.indexOf(featureId);
      if (idx === -1) return;

      const startX = e.clientX;
      const startY = e.clientY;
      let activated = false;

      const activate = () => {
        activated = true;
        setDragState({ featureId, sourceIndex: idx, targetIndex: idx });
        targetIndexRef.current = idx;
        onDragActiveChange?.(true);
      };

      const handleMove = (ev: PointerEvent) => {
        if (!activated) {
          const dist = Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY);
          if (dist < DRAG_ACTIVATION_DISTANCE) return;
          activate();
        }

        const inner = innerRef.current;
        if (!inner) return;
        const rect = inner.getBoundingClientRect();
        const relY = ev.clientY - rect.top;
        const ids = featureIdsRef.current;
        const target = Math.max(0, Math.min(ids.length - 1, Math.floor(relY / ROW_HEIGHT)));

        if (target !== targetIndexRef.current) {
          targetIndexRef.current = target;
          setDragState((prev) => (prev ? { ...prev, targetIndex: target } : null));
        }
      };

      const handleUp = () => {
        document.removeEventListener('pointermove', handleMove);
        document.removeEventListener('pointerup', handleUp);

        if (!activated) return;

        // Suppress the click that follows pointerup
        dragJustEndedRef.current = true;
        requestAnimationFrame(() => { dragJustEndedRef.current = false; });

        const src = idx;
        const tgt = targetIndexRef.current;

        setDragState(null);
        targetIndexRef.current = -1;
        onDragActiveChange?.(false);

        if (tgt !== src && tgt >= 0 && tgt < featureIdsRef.current.length) {
          const newOrder = [...featureIdsRef.current];
          const [moved] = newOrder.splice(src, 1);
          newOrder.splice(tgt, 0, moved);
          onReorder?.(newOrder);
        }
      };

      document.addEventListener('pointermove', handleMove);
      document.addEventListener('pointerup', handleUp);
    },
    [onDragActiveChange, onReorder]
  );

  // Ensure cleanup on unmount
  useEffect(() => {
    return () => {
      targetIndexRef.current = -1;
    };
  }, []);

  // Track shift key for chain mode visual hint
  const [shiftHeld, setShiftHeld] = useState(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftHeld(true); };
    const up = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftHeld(false); };
    const blur = () => setShiftHeld(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  const hasFeatures = featureIds.length > 0;

  return (
    <div
      style={{ width, minWidth: width, maxWidth: width }}
      className="flex flex-col border-r border-border bg-background select-none"
    >
      {/* Header — milestone selector */}
      <div
        className="flex items-center gap-1.5 px-3 border-b border-border shrink-0"
        style={{ height: SCALE_HEIGHT * 2 }}
      >
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-1.5 min-w-0 flex-1 rounded-md px-1.5 -ml-1 py-1 hover:bg-accent/40 transition-colors">
              <div
                className="flex items-center justify-center h-5 w-5 rounded-full shrink-0"
                style={{ backgroundColor: getColorStyles(project.color).iconBg, color: getColorStyles(project.color).hex }}
              >
                <MilestoneIcon name={project.icon} className="h-3 w-3" />
              </div>
              <span className="text-sm font-medium truncate min-w-0">{project.name}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0 ml-auto" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
            <div className="py-1 max-h-64 overflow-y-auto">
              {(allProjects ?? [project]).map((p) => {
                const isActive = p.id === project.id;
                const styles = getColorStyles(p.color);
                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs transition-colors cursor-pointer group/item ${
                      isActive ? 'bg-accent/50' : 'hover:bg-muted'
                    }`}
                    role="button"
                    onClick={() => {
                      if (!isActive && onProjectChange) onProjectChange(p.id);
                    }}
                  >
                    <div
                      className="flex items-center justify-center h-4 w-4 rounded-full shrink-0"
                      style={{ backgroundColor: styles.iconBg, color: styles.hex }}
                    >
                      <MilestoneIcon name={p.icon} className="h-2.5 w-2.5" />
                    </div>
                    <span className="flex-1 text-left truncate font-medium">{p.name}</span>
                    <button
                      className="flex items-center justify-center h-5 w-5 rounded text-muted-foreground opacity-0 group-hover/item:opacity-100 hover:text-foreground hover:bg-accent transition-all shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMilestoneClick?.(p);
                      }}
                      title="Edit milestone"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
            {onAddMilestone && (
              <>
                <div className="h-px bg-border" />
                <div
                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                  role="button"
                  onClick={onAddMilestone}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="font-medium">New milestone</span>
                </div>
              </>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {/* Scrollable row body — overflow hidden, synced via translateY from chart scroll */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-hidden"
      >
        <div ref={innerRef} style={{ position: 'relative' }}>
          {tasks.map((task) => {
            if (task.id === ADD_FEATURE_TASK_ID) {
              const showChainHint = shiftHeld && hasFeatures;
              return (
                <div
                  key={task.id}
                  style={{ height: ROW_HEIGHT }}
                  className={`flex items-center gap-1.5 px-3 cursor-pointer transition-colors border-b border-border ${
                    showChainHint
                      ? 'text-primary'
                      : 'text-muted-foreground'
                  }`}
                  onClick={(e) => onAddFeature(e.shiftKey && hasFeatures ? { chain: true } : undefined)}
                >
                  {showChainHint ? (
                    <Link2 className="h-3.5 w-3.5" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  <span className="text-xs">
                    {showChainHint ? 'Chain feature' : 'Add feature'}
                  </span>
                  <kbd className="ml-auto text-[11px] font-mono text-muted-foreground/40 mr-1">
                    {showChainHint ? 'Shift F' : 'F'}
                  </kbd>
                </div>
              );
            }

            const custom = task.$custom;
            const isTeamTrack = custom?.isTeamTrack && task.parent;

            if (isTeamTrack) {
              const hideTrack = isDragging;
              return (
                <div
                  key={task.id}
                  style={{
                    height: hideTrack ? 0 : ROW_HEIGHT,
                    opacity: hideTrack ? 0 : 1,
                    transition: 'height 200ms ease, opacity 150ms ease',
                  }}
                  className="flex items-center gap-1.5 min-w-0 pl-7 pr-3 cursor-pointer border-b border-border overflow-hidden"
                  onClick={() => onRowClick(task)}
                >
                  <div
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: custom?.teamColor }}
                  />
                  <span className="truncate min-w-0 flex-1 text-xs text-muted-foreground">
                    {task.text}
                  </span>
                  <span className="shrink-0 ml-auto rounded border border-border/60 px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground/50 tabular-nums">
                    {task.durationText}
                  </span>
                </div>
              );
            }

            // Feature row (manually sortable)
            if (featureIdSet.has(task.id)) {
              const isDragSource = task.id === activeId;

              return (
                <div
                  key={task.id}
                  style={{
                    height: ROW_HEIGHT,
                    opacity: isDragSource ? 0.3 : 1,
                    transition: 'opacity 150ms ease',
                  }}
                  className={`flex items-center gap-1.5 min-w-0 px-3 cursor-pointer border-b border-border bg-background ${
                    isDragging ? '' : 'group/gridrow'
                  }`}
                  onClick={() => { if (!dragJustEndedRef.current) onRowClick(task); }}
                  onPointerDown={onReorder ? (e) => handleGripPointerDown(task.id, e) : undefined}
                >
                  <div
                    className="flex items-center justify-center shrink-0 w-0 opacity-0 group-hover/gridrow:w-5 group-hover/gridrow:opacity-100 transition-all duration-150 overflow-hidden"
                  >
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                  </div>
                  <StatusToggle
                    id={task.id}
                    status={custom?.status ?? 'not_started'}
                    onToggle={onStatusChange}
                  />
                  <span
                    className={`truncate min-w-0 flex-1 text-sm ${
                      custom?.status === 'completed'
                        ? 'line-through text-muted-foreground'
                        : ''
                    }`}
                  >
                    {task.text}
                  </span>
                  <span className="shrink-0 ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground">
                    {task.durationText}
                  </span>
                </div>
              );
            }

            // Fallback: regular feature row (shouldn't happen)
            return (
              <div
                key={task.id}
                style={{ height: ROW_HEIGHT }}
                className="flex items-center gap-1.5 min-w-0 px-3 cursor-pointer transition-colors border-b border-border"
                onClick={() => onRowClick(task)}
              >
                <StatusToggle
                  id={task.id}
                  status={custom?.status ?? 'not_started'}
                  onToggle={onStatusChange}
                />
                <span
                  className={`truncate min-w-0 flex-1 text-sm ${
                    custom?.status === 'completed'
                      ? 'line-through text-muted-foreground'
                      : ''
                  }`}
                >
                  {task.text}
                </span>
                <span className="shrink-0 ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground">
                  {task.durationText}
                </span>
              </div>
            );
          })}

          {/* Insertion line indicator */}
          {insertLineY !== null && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: insertLineY,
                zIndex: 20,
                pointerEvents: 'none',
                transform: 'translateY(-50%)',
              }}
            >
              <div className="relative h-0.5 bg-primary rounded-full mx-1">
                <div className="absolute -left-0.5 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
