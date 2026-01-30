import { format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { STATUS_CONFIG, RESIZE_HANDLE_WIDTH, CONNECTION_HANDLE_SIZE } from './constants';
import type { GanttBarProps, DragType, ConnectionSide } from './types';

// Helper to parse a date and get midnight in local time
// This handles both ISO strings (which may be UTC midnight) and Date objects
// by extracting the date portion and creating a local midnight Date
function toLocalMidnight(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : date;
  // Extract UTC date components to avoid timezone shifting
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const day = d.getUTCDate();
  // Create a new date at local midnight with those components
  return new Date(year, month, day);
}

function formatDuration(days: number): string {
  if (days < 7) return `${days}d`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    const remainingDays = days % 7;
    return remainingDays > 0 ? `${weeks}w ${remainingDays}d` : `${weeks}w`;
  }
  const months = Math.floor(days / 30);
  const remainingDays = days % 30;
  return remainingDays > 0 ? `${months}mo ${remainingDays}d` : `${months}mo`;
}

export function GanttBar({
  milestone,
  left,
  width,
  isDragging,
  isEditable,
  onMouseDown,
  onClick,
  onDependencyDragStart,
  showConnectionHandles = false,
}: GanttBarProps) {
  const config = STATUS_CONFIG[milestone.status] || STATUS_CONFIG.not_started;

  // Calculate date range and duration for tooltip
  const startDate = toLocalMidnight(milestone.startDate);
  const endDate = toLocalMidnight(milestone.endDate);
  const days = differenceInDays(endDate, startDate) + 1;
  const dateRangeText = `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d')}`;
  const durationText = formatDuration(days);

  const handleMouseDown = (e: React.MouseEvent, type: DragType) => {
    e.preventDefault();
    e.stopPropagation();
    onMouseDown(e, type);
  };

  const handleConnectionDragStart = (e: React.MouseEvent, side: ConnectionSide) => {
    e.preventDefault();
    e.stopPropagation();
    onDependencyDragStart?.(e, side);
  };

  // For editable users: click handling is done in the parent GanttChart via handleMouseUp
  // For non-editable users: we handle click directly since they can't drag
  const handleClick = (e: React.MouseEvent) => {
    if (!isEditable && !isDragging) {
      e.stopPropagation();
      onClick();
    }
  };

  // Calculate label offset - account for connection handle if showing
  const labelOffset = showConnectionHandles && isEditable
    ? width + CONNECTION_HANDLE_SIZE / 2 + 8
    : width + 8;

  return (
    <div
      className={cn(
        'absolute top-1 bottom-1 group cursor-pointer',
        isDragging && 'z-10'
      )}
      style={{
        left,
        width,
      }}
      onClick={handleClick}
      onMouseDown={(e) => isEditable && handleMouseDown(e, 'move')}
    >
      {/* Bar background with visual styling */}
      <div
        className={cn(
          'absolute inset-0 rounded-[3px] overflow-hidden',
          isDragging && 'shadow-lg ring-2 ring-primary ring-offset-1',
          !isDragging && 'hover:shadow-md hover:brightness-105'
        )}
        style={{
          backgroundColor: `color-mix(in srgb, ${config.bgColor} 20%, transparent)`,
          transition: 'box-shadow 150ms',
        }}
      >
        {/* Left colored indicator - inside the bar for perfect alignment */}
        <div
          className="absolute inset-y-0 left-0 w-[3px] pointer-events-none"
          style={{ backgroundColor: config.bgColor }}
        />

        {/* Left resize handle */}
        {isEditable && (
          <div
            className={cn(
              'absolute inset-y-0 left-0 cursor-ew-resize z-10 flex items-center justify-center',
              'opacity-0 group-hover:opacity-100 transition-opacity'
            )}
            style={{ width: RESIZE_HANDLE_WIDTH }}
            onMouseDown={(e) => handleMouseDown(e, 'resize-start')}
          >
            <div
              className="w-0.5 h-3 rounded-full"
              style={{ backgroundColor: config.bgColor }}
            />
          </div>
        )}

        {/* Right resize handle */}
        {isEditable && (
          <div
            className={cn(
              'absolute inset-y-0 right-0 cursor-ew-resize z-10 flex items-center justify-center',
              'opacity-0 group-hover:opacity-100 transition-opacity'
            )}
            style={{ width: RESIZE_HANDLE_WIDTH }}
            onMouseDown={(e) => handleMouseDown(e, 'resize-end')}
          >
            <div
              className="w-0.5 h-3 rounded-full"
              style={{ backgroundColor: config.bgColor }}
            />
          </div>
        )}
      </div>

      {/* Connection handle (left side - start date) - outside the bar */}
      {showConnectionHandles && isEditable && (
        <div
          className={cn(
            'absolute top-1/2 -translate-y-1/2 rounded-full cursor-crosshair',
            'opacity-0 group-hover:opacity-100 transition-all duration-150 z-20',
            'hover:scale-125'
          )}
          style={{
            left: -CONNECTION_HANDLE_SIZE / 2,
            width: CONNECTION_HANDLE_SIZE,
            height: CONNECTION_HANDLE_SIZE,
            backgroundColor: 'var(--background)',
            border: `2px solid ${config.bgColor}`,
            boxShadow: 'var(--shadow-sm)',
          }}
          onMouseDown={(e) => handleConnectionDragStart(e, 'start')}
          title="Drag to create dependency from start"
        />
      )}

      {/* Connection handle (right side - end date) - outside the bar */}
      {showConnectionHandles && isEditable && (
        <div
          className={cn(
            'absolute top-1/2 -translate-y-1/2 rounded-full cursor-crosshair',
            'opacity-0 group-hover:opacity-100 transition-all duration-150 z-20',
            'hover:scale-125'
          )}
          style={{
            right: -CONNECTION_HANDLE_SIZE / 2,
            width: CONNECTION_HANDLE_SIZE,
            height: CONNECTION_HANDLE_SIZE,
            backgroundColor: 'var(--background)',
            border: `2px solid ${config.bgColor}`,
            boxShadow: 'var(--shadow-sm)',
          }}
          onMouseDown={(e) => handleConnectionDragStart(e, 'end')}
          title="Drag to create dependency from end"
        />
      )}

      {/* Label - positioned outside to the right, accounting for connection handle */}
      <div
        className="absolute top-1/2 -translate-y-1/2 flex items-center pointer-events-none"
        style={{ left: labelOffset }}
      >
        <span
          className="text-xs font-medium truncate whitespace-nowrap"
          style={{
            color: 'var(--foreground)',
            maxWidth: 200,
          }}
        >
          {milestone.title}
        </span>
      </div>

      {/* Hover tooltip with date range and duration */}
      {!isDragging && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 px-2.5 py-1.5 bg-popover border border-border/50 rounded-[var(--radius)] text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30 shadow-md">
          <span className="text-foreground font-medium">{dateRangeText}</span>
          <span className="text-muted-foreground ml-1.5">({durationText})</span>
        </div>
      )}
    </div>
  );
}
