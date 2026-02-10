"use client";

import { ChevronDown } from "lucide-react";
import { MilestoneIcon } from "@/lib/milestone-icon";
import { getColorStyles } from "@/lib/milestone-theme";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  milestoneId: string;
  name: string;
  color: string;
  icon: string;
  featureCount: number;
  completedCount: number;
  collapsed: boolean;
  onToggle: () => void;
}

export function SectionHeader({
  name,
  color,
  icon,
  featureCount,
  completedCount,
  collapsed,
  onToggle,
}: SectionHeaderProps) {
  const styles = getColorStyles(color);
  const progress =
    featureCount > 0 ? Math.round((completedCount / featureCount) * 100) : 0;

  return (
    <button
      onClick={onToggle}
      className={cn(
        "w-full text-left group relative overflow-hidden bg-background px-4 py-3 transition-colors hover:bg-accent/50",
        collapsed ? "rounded-2xl" : "rounded-t-2xl border-b"
      )}
      style={{
        background: `linear-gradient(to right, transparent 30%, ${styles.gradient} 100%)`,
      }}
    >
      <div className="flex items-center gap-3">
        {/* Icon in colored circle */}
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: styles.iconBg, color: styles.hex }}
        >
          <MilestoneIcon name={icon} className="h-4 w-4" />
        </div>

        {/* Name + count */}
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <span className="text-sm font-medium truncate">{name}</span>
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {completedCount}/{featureCount}
          </span>
        </div>

        {/* Chevron */}
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            collapsed && "-rotate-90"
          )}
        />
      </div>

      {/* Progress rail at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-muted/50">
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${progress}%`, backgroundColor: styles.hex }}
        />
      </div>
    </button>
  );
}
