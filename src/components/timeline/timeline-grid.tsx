'use client';

import { type RefObject } from 'react';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { ROW_HEIGHT, SCALE_HEIGHT } from './scales-config';
import { MilestoneIcon } from '@/lib/milestone-icon';
import { getColorStyles } from '@/lib/milestone-theme';
import type { SVARTask } from './types';
import type { Milestone, MilestoneStatus, Project } from '@/db/schema';

const ADD_FEATURE_TASK_ID = '__add_feature__';

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
  width: number;
  scrollRef: RefObject<HTMLDivElement | null>;
  onRowClick: (task: SVARTask) => void;
  onStatusChange: RefObject<(id: string, status: MilestoneStatus) => Promise<void>>;
  onAddFeature: () => void;
  project: Project;
  allProjects?: Project[];
  onProjectChange?: (id: string) => void;
}

export function TimelineGrid({
  tasks,
  width,
  scrollRef,
  onRowClick,
  onStatusChange,
  onAddFeature,
  project,
  allProjects,
  onProjectChange,
}: TimelineGridProps) {
  const hasMultiple = allProjects && allProjects.length > 1 && onProjectChange;
  const projectIdx = hasMultiple ? allProjects.findIndex((p) => p.id === project.id) : -1;

  return (
    <div
      style={{ width, minWidth: width, maxWidth: width }}
      className="flex flex-col border-r border-border bg-background select-none"
    >
      {/* Header — project selector + feature count */}
      <div
        className="flex items-center gap-1.5 px-3 border-b border-border shrink-0"
        style={{ height: SCALE_HEIGHT * 2 }}
      >
        <div
          className="flex items-center justify-center h-5 w-5 rounded-full shrink-0"
          style={{ backgroundColor: getColorStyles(project.color).iconBg, color: getColorStyles(project.color).hex }}
        >
          <MilestoneIcon name={project.icon} className="h-3 w-3" />
        </div>
        <span className="text-sm font-medium truncate min-w-0 flex-1">{project.name}</span>
        {hasMultiple && (
          <div className="flex items-center shrink-0 ml-1">
            <button
              className="flex items-center justify-center h-5 w-5 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              onClick={() => {
                if (projectIdx > 0) onProjectChange!(allProjects![projectIdx - 1].id);
              }}
              disabled={projectIdx <= 0}
              title="Previous milestone"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
            <button
              className="flex items-center justify-center h-5 w-5 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              onClick={() => {
                if (projectIdx < allProjects!.length - 1) onProjectChange!(allProjects![projectIdx + 1].id);
              }}
              disabled={projectIdx >= allProjects!.length - 1}
              title="Next milestone"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Scrollable row body — overflow hidden, synced via translateY from chart scroll */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-hidden"
      >
        <div>
        {tasks.map((task) => {
          if (task.id === ADD_FEATURE_TASK_ID) {
            return (
              <div
                key={task.id}
                style={{ height: ROW_HEIGHT }}
                className="flex items-center gap-1.5 px-3 text-muted-foreground cursor-pointer transition-colors border-b border-border"
                onClick={onAddFeature}
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="text-xs">Add feature</span>
              </div>
            );
          }

          const custom = task.$custom;
          const isTeamTrack = custom?.isTeamTrack && task.parent;

          if (isTeamTrack) {
            return (
              <div
                key={task.id}
                style={{ height: ROW_HEIGHT }}
                className="flex items-center gap-1.5 min-w-0 pl-7 pr-3 cursor-pointer transition-colors border-b border-border"
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

          // Feature row
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
        </div>
      </div>
    </div>
  );
}
