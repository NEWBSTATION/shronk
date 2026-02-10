"use client";

import { ChevronRight, GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const PRIORITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#64748b",
};

interface FeatureRowProps {
  id: string;
  title: string;
  status: string;
  priority: string;
  duration: number;
  selected: boolean;
  selectMode: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onClick: () => void;
  onToggleComplete?: () => void;
  isDragging?: boolean;
  isOverlay?: boolean;
  dragHandleProps?: Record<string, unknown>;
  nodeRef?: (node: HTMLElement | null) => void;
  style?: React.CSSProperties;
}

export function FeatureRow({
  title,
  status,
  priority,
  duration,
  selected,
  selectMode,
  onSelect,
  onClick,
  onToggleComplete,
  isDragging,
  isOverlay,
  dragHandleProps,
  nodeRef,
  style,
}: FeatureRowProps) {
  const completed = status === "completed";
  const priorityColor = PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.medium;

  return (
    <div
      ref={nodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 px-4 py-3.5 transition-colors cursor-pointer group bg-background hover:bg-accent/50 border-b last:border-b-0",
        selected && "bg-accent",
        isDragging && "opacity-30",
        isOverlay && "border rounded-lg shadow-lg"
      )}
    >
      {/* Drag handle: visible on hover, hidden in select mode */}
      {!selectMode && (
        <div
          className={cn(
            "shrink-0 w-4 flex items-center justify-center cursor-grab active:cursor-grabbing transition-opacity",
            isOverlay ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
          {...dragHandleProps}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground/50" />
        </div>
      )}

      {/* Checkbox: always visible in select mode, hover-reveal otherwise */}
      <div
        className={cn(
          "shrink-0 w-5 flex items-center justify-center",
          selectMode ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(e);
        }}
      >
        <Checkbox checked={selected} className="h-4 w-4" />
      </div>

      {/* Completion toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleComplete?.();
        }}
        className={cn(
          "shrink-0 rounded-full transition-colors",
          completed
            ? "text-green-500 hover:text-green-600"
            : "text-muted-foreground/40 hover:text-muted-foreground/70"
        )}
        title={completed ? "Mark incomplete" : "Mark completed"}
      >
        {completed ? (
          <svg className="h-4.5 w-4.5" viewBox="0 -960 960 960" fill="currentColor">
            <path d="m429-336 238-237-51-51-187 186-85-84-51 51 136 135Zm51 240q-79 0-149-30t-122.5-82.5Q156-261 126-331T96-480q0-80 30-149.5t82.5-122Q261-804 331-834t149-30q80 0 149.5 30t122 82.5Q804-699 834-629.5T864-480q0 79-30 149t-82.5 122.5Q699-156 629.5-126T480-96Z" />
          </svg>
        ) : (
          <svg className="h-4.5 w-4.5" viewBox="0 -960 960 960" fill="currentColor">
            <path d="m429-336 238-237-51-51-187 186-85-84-51 51 136 135Zm51 240q-79 0-149-30t-122.5-82.5Q156-261 126-331T96-480q0-80 30-149.5t82.5-122Q261-804 331-834t149-30q80 0 149.5 30t122 82.5Q804-699 834-629.5T864-480q0 79-30 149t-82.5 122.5Q699-156 629.5-126T480-96Zm0-72q130 0 221-91t91-221q0-130-91-221t-221-91q-130 0-221 91t-91 221q0 130 91 221t221 91Zm0-312Z" />
          </svg>
        )}
      </button>

      {/* Feature name — click area for the row */}
      <button
        onClick={onClick}
        className="flex flex-1 items-center gap-3 min-w-0"
      >
        <span
          className={cn(
            "text-sm flex-1 truncate text-left",
            completed && "text-muted-foreground line-through"
          )}
        >
          {title}
        </span>

        {/* Right side: priority dot + duration + chevron */}
        <div className="flex items-center gap-2.5 shrink-0">
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: priorityColor }}
          />
          <span className="text-xs text-muted-foreground tabular-nums">
            {duration}d
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </button>
    </div>
  );
}

export function SortableFeatureRow(
  props: Omit<
    FeatureRowProps,
    "isDragging" | "isOverlay" | "dragHandleProps" | "nodeRef" | "style"
  >
) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <FeatureRow
      {...props}
      nodeRef={setNodeRef}
      style={style}
      isDragging={isDragging}
      dragHandleProps={
        props.selectMode ? undefined : { ...attributes, ...listeners }
      }
    />
  );
}
