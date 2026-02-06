import {
  Edit2,
  Trash2,
  Play,
  Pause,
  CircleCheck,
  XCircle,
  Circle,
  Flag,
} from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';
import type { Milestone, MilestoneStatus, MilestonePriority } from '@/db/schema';

interface MilestoneContextMenuProps {
  milestone: Milestone;
  onEdit: (milestone: Milestone) => void;
  onDelete: (id: string) => void;
  onStatusChange?: (id: string, status: MilestoneStatus) => void;
  onPriorityChange?: (id: string, priority: MilestonePriority) => void;
  canEdit: boolean;
  children: React.ReactNode;
}

const statusOptions: { value: MilestoneStatus; label: string; icon: typeof Circle; color: string }[] = [
  { value: 'not_started', label: 'Not Started', icon: Circle, color: 'text-muted-foreground' },
  { value: 'in_progress', label: 'In Progress', icon: Play, color: 'text-blue-500' },
  { value: 'on_hold', label: 'On Hold', icon: Pause, color: 'text-amber-500' },
  { value: 'completed', label: 'Completed', icon: CircleCheck, color: 'text-emerald-500' },
  { value: 'cancelled', label: 'Cancelled', icon: XCircle, color: 'text-red-500' },
];

const priorityOptions: { value: MilestonePriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'text-slate-400' },
  { value: 'medium', label: 'Medium', color: 'text-blue-500' },
  { value: 'high', label: 'High', color: 'text-amber-500' },
  { value: 'critical', label: 'Urgent', color: 'text-red-500' },
];

export function MilestoneContextMenu({
  milestone,
  onEdit,
  onDelete,
  onStatusChange,
  onPriorityChange,
  canEdit,
  children,
}: MilestoneContextMenuProps) {
  if (!canEdit) {
    return <>{children}</>;
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={() => onEdit(milestone)}>
          <Edit2 className="mr-2 h-4 w-4" />
          Edit
        </ContextMenuItem>

        {onStatusChange && (
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <Play className="mr-2 h-4 w-4" />
              Set Status
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-44">
              {statusOptions.map((status) => (
                <ContextMenuItem
                  key={status.value}
                  onClick={() => onStatusChange(milestone.id, status.value)}
                  className={cn(
                    milestone.status === status.value && 'bg-accent'
                  )}
                >
                  <status.icon className={cn('mr-2 h-4 w-4', status.color)} />
                  {status.label}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}

        {onPriorityChange && (
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <Flag className="mr-2 h-4 w-4" />
              Set Priority
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-40">
              {priorityOptions.map((priority) => (
                <ContextMenuItem
                  key={priority.value}
                  onClick={() => onPriorityChange(milestone.id, priority.value)}
                  className={cn(
                    milestone.priority === priority.value && 'bg-accent'
                  )}
                >
                  <Flag className={cn('mr-2 h-4 w-4', priority.color)} />
                  {priority.label}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}

        <ContextMenuSeparator />

        <ContextMenuItem
          onClick={() => onDelete(milestone.id)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
