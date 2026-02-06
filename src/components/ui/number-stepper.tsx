"use client";

import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface NumberStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

export function NumberStepper({
  value,
  onChange,
  min = 1,
  max,
  step = 1,
  className,
}: NumberStepperProps) {
  const clamp = (v: number) => {
    let clamped = v;
    if (min !== undefined) clamped = Math.max(min, clamped);
    if (max !== undefined) clamped = Math.min(max, clamped);
    return clamped;
  };

  return (
    <div className={cn("relative flex items-center", className)}>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value) || min))}
        min={min}
        max={max}
        step={step}
        className="h-9 w-full rounded-md border border-input bg-transparent pl-3 pr-7 text-sm shadow-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <div className="absolute right-0 inset-y-0 flex flex-col border-l">
        <button
          type="button"
          tabIndex={-1}
          onClick={() => onChange(clamp(value + step))}
          className="flex-1 flex items-center justify-center px-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-tr-md transition-colors"
        >
          <ChevronUp className="h-3 w-3" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          onClick={() => onChange(clamp(value - step))}
          className="flex-1 flex items-center justify-center px-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-br-md transition-colors"
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
