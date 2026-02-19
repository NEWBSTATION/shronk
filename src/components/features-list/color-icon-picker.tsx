"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  MILESTONE_COLOR_KEYS,
  getColorHex,
} from "@/lib/milestone-theme";
import { MILESTONE_ICONS, MilestoneIcon } from "@/lib/milestone-icon";
import { cn } from "@/lib/utils";

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface ColorIconPickerProps {
  color: string;
  icon: string;
  onColorChange: (color: string) => void;
  onIconChange: (icon: string) => void;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function PickerGrid({
  color,
  icon,
  onColorChange,
  onIconChange,
}: Pick<ColorIconPickerProps, "color" | "icon" | "onColorChange" | "onIconChange">) {
  return (
    <TooltipProvider delayDuration={200}>
      {/* Color grid */}
      <p className="text-xs font-medium text-muted-foreground mb-2">Color</p>
      <div className="grid grid-cols-6 gap-2 mb-4">
        {MILESTONE_COLOR_KEYS.map((key) => {
          const hex = getColorHex(key);
          const active = key === color;
          return (
            <Tooltip key={key}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onColorChange(key)}
                  className={cn(
                    "h-7 w-7 rounded-full transition-all flex items-center justify-center",
                    active && "ring-2 ring-offset-2 ring-offset-background"
                  )}
                  style={{
                    backgroundColor: hex,
                    ...(active ? { ringColor: hex } : {}),
                  }}
                >
                  {active && (
                    <svg
                      className="h-3 w-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={4}>
                {capitalize(key)}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {/* Icon grid */}
      <p className="text-xs font-medium text-muted-foreground mb-2">Icon</p>
      <div className="grid grid-cols-5 gap-1">
        {MILESTONE_ICONS.map((name) => {
          const active = name === icon;
          return (
            <Tooltip key={name}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onIconChange(name)}
                  className={cn(
                    "h-8 w-8 rounded-md flex items-center justify-center transition-colors",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  <MilestoneIcon name={name} className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={4}>
                {capitalize(name)}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

export function ColorIconPicker({
  color,
  icon,
  onColorChange,
  onIconChange,
  onOpenChange,
  children,
}: ColorIconPickerProps) {
  return (
    <Popover onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <PickerGrid
          color={color}
          icon={icon}
          onColorChange={onColorChange}
          onIconChange={onIconChange}
        />
      </PopoverContent>
    </Popover>
  );
}
