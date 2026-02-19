"use client";

import { cn } from "@/lib/utils";
import type { MilestoneStatus, MilestonePriority } from "@/db/schema";
import {
  Circle,
  Play,
  Pause,
  CircleCheck,
  XCircle,
} from "lucide-react";

// ---------- Linear-style priority icons ----------

type IconProps = React.SVGProps<SVGSVGElement>;

/** Three dots — "No Priority" */
function PriorityNoneIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" {...props}>
      <circle cx="3" cy="8" r="1.5" />
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="13" cy="8" r="1.5" />
    </svg>
  );
}

/** 1 of 4 bars filled */
function PriorityLowIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" {...props}>
      <rect x="1" y="11" width="2.5" height="3" rx="0.5" opacity="1" />
      <rect x="5" y="8" width="2.5" height="6" rx="0.5" opacity="0.2" />
      <rect x="9" y="5" width="2.5" height="9" rx="0.5" opacity="0.2" />
      <rect x="13" y="2" width="2.5" height="12" rx="0.5" opacity="0.2" />
    </svg>
  );
}

/** 2 of 4 bars filled */
function PriorityMediumIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" {...props}>
      <rect x="1" y="11" width="2.5" height="3" rx="0.5" opacity="1" />
      <rect x="5" y="8" width="2.5" height="6" rx="0.5" opacity="1" />
      <rect x="9" y="5" width="2.5" height="9" rx="0.5" opacity="0.2" />
      <rect x="13" y="2" width="2.5" height="12" rx="0.5" opacity="0.2" />
    </svg>
  );
}

/** 3 of 4 bars filled */
function PriorityHighIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" {...props}>
      <rect x="1" y="11" width="2.5" height="3" rx="0.5" opacity="1" />
      <rect x="5" y="8" width="2.5" height="6" rx="0.5" opacity="1" />
      <rect x="9" y="5" width="2.5" height="9" rx="0.5" opacity="1" />
      <rect x="13" y="2" width="2.5" height="12" rx="0.5" opacity="0.2" />
    </svg>
  );
}

/** Exclamation in rounded square — "Urgent" */
function PriorityUrgentIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" {...props}>
      <path
        d="M3 1a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V3a2 2 0 00-2-2H3z"
        fillOpacity="0.15"
      />
      <path d="M3 1a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V3a2 2 0 00-2-2H3zm0 1h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" />
      <rect x="7" y="4" width="2" height="5" rx="1" />
      <circle cx="8" cy="11.5" r="1" />
    </svg>
  );
}

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
  none: {
    label: "No Priority",
    icon: PriorityNoneIcon,
    className: "bg-muted/50 text-muted-foreground/70",
  },
  low: {
    label: "Low",
    icon: PriorityLowIcon,
    className: "bg-muted text-muted-foreground",
  },
  medium: {
    label: "Medium",
    icon: PriorityMediumIcon,
    className: "bg-muted text-muted-foreground",
  },
  high: {
    label: "High",
    icon: PriorityHighIcon,
    className: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
  critical: {
    label: "Urgent",
    icon: PriorityUrgentIcon,
    className: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
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

  if (!showLabel) {
    return (
      <span className={cn("inline-flex items-center", config.className.split(" ").filter(c => c.startsWith("text-")).join(" "), className)}>
        <Icon className="h-4 w-4" />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
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
    none: "hsl(var(--muted-foreground))",
    low: "hsl(var(--muted-foreground))",
    medium: "hsl(var(--muted-foreground))",
    high: "hsl(25, 95%, 53%)",
    critical: "hsl(25, 95%, 53%)",
  };
  return colors[priority];
}

export { statusConfig, priorityConfig };
