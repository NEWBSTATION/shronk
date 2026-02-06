"use client";

import { cn } from "@/lib/utils";
import type { MilestoneStatus, MilestonePriority } from "@/db/schema";
import {
  Circle,
  Play,
  Pause,
  CircleCheck,
  XCircle,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react";

const statusConfig: Record<
  MilestoneStatus,
  { label: string; icon: React.ElementType; className: string }
> = {
  not_started: {
    label: "Not Started",
    icon: Circle,
    className: "bg-muted text-muted-foreground",
  },
  in_progress: {
    label: "In Progress",
    icon: Play,
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  on_hold: {
    label: "On Hold",
    icon: Pause,
    className: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  },
  completed: {
    label: "Completed",
    icon: CircleCheck,
    className: "bg-green-500/10 text-green-600 dark:text-green-400",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    className: "bg-red-500/10 text-red-600 dark:text-red-400",
  },
};

const priorityConfig: Record<
  MilestonePriority,
  { label: string; icon: React.ElementType; className: string }
> = {
  low: {
    label: "Low",
    icon: ArrowDown,
    className: "bg-muted text-muted-foreground",
  },
  medium: {
    label: "Medium",
    icon: Minus,
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  high: {
    label: "High",
    icon: ArrowUp,
    className: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
  critical: {
    label: "Critical",
    icon: AlertTriangle,
    className: "bg-red-500/10 text-red-600 dark:text-red-400",
  },
};

interface StatusBadgeProps {
  status: MilestoneStatus;
  showLabel?: boolean;
  className?: string;
}

export function StatusBadge({
  status,
  showLabel = true,
  className,
}: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {showLabel && config.label}
    </span>
  );
}

interface PriorityBadgeProps {
  priority: MilestonePriority;
  showLabel?: boolean;
  className?: string;
}

export function PriorityBadge({
  priority,
  showLabel = true,
  className,
}: PriorityBadgeProps) {
  const config = priorityConfig[priority];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {showLabel && config.label}
    </span>
  );
}

export function getStatusColor(status: MilestoneStatus): string {
  const colors: Record<MilestoneStatus, string> = {
    not_started: "hsl(var(--muted))",
    in_progress: "hsl(221, 83%, 53%)",
    on_hold: "hsl(45, 93%, 47%)",
    completed: "hsl(142, 71%, 45%)",
    cancelled: "hsl(0, 84%, 60%)",
  };
  return colors[status];
}

export function getPriorityColor(priority: MilestonePriority): string {
  const colors: Record<MilestonePriority, string> = {
    low: "hsl(var(--muted))",
    medium: "hsl(221, 83%, 53%)",
    high: "hsl(25, 95%, 53%)",
    critical: "hsl(0, 84%, 60%)",
  };
  return colors[priority];
}

export { statusConfig, priorityConfig };
