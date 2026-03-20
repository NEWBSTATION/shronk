"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Plus, Link, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { addDays } from "date-fns";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface InlineCreateRowProps {
  milestoneId: string;
  lastFeature?: { id: string; endDate: Date | string } | null;
  onClose: () => void;
}

export function InlineCreateRow({
  milestoneId,
  lastFeature,
  onClose,
}: InlineCreateRowProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [chainActive, setChainActive] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null);
  const [lastCreatedEndDate, setLastCreatedEndDate] = useState<Date | string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  // Close on click outside (only if input is empty)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (!title.trim()) onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose, title]);

  // The effective predecessor for chaining: either the last created feature or the last existing one
  const chainPredecessor = lastCreatedId
    ? { id: lastCreatedId, endDate: lastCreatedEndDate! }
    : lastFeature;

  const handleCreate = useCallback(async () => {
    const trimmed = title.trim();
    if (!trimmed || isCreating) return;

    setIsCreating(true);
    try {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      const startDate = chainActive && chainPredecessor
        ? addDays(new Date(chainPredecessor.endDate), 1)
        : today;

      const duration = 1;
      const endDate = startDate;

      const res = await fetch("/api/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: milestoneId,
          title: trimmed,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          duration,
          status: "not_started",
          priority: "none",
        }),
      });

      if (!res.ok) throw new Error("Failed to create feature");
      const newFeature = await res.json();

      // Create dependency if chaining
      if (chainActive && chainPredecessor) {
        await fetch("/api/dependencies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            predecessorId: chainPredecessor.id,
            successorId: newFeature.id,
          }),
        });
      }

      // Track last created for chaining subsequent features
      setLastCreatedId(newFeature.id);
      setLastCreatedEndDate(newFeature.endDate);

      // Refresh feature lists
      queryClient.invalidateQueries({ queryKey: ["allFeatures"] });
      queryClient.invalidateQueries({ queryKey: ["milestones"] });

      // Reset for next creation
      setTitle("");
      setIsCreating(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch {
      setIsCreating(false);
    }
  }, [title, isCreating, milestoneId, chainActive, chainPredecessor, queryClient]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleCreate();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [handleCreate, onClose]
  );

  return (
    <div
      ref={containerRef}
      className="flex items-center gap-1.5 mx-2 mb-2 mt-1 pl-1 pr-2 h-11 rounded-lg border border-border/60 bg-card shadow-sm"
    >
      {/* Plus icon — aligned with feature row checkbox (h-6 w-6) */}
      <div className="shrink-0 h-6 w-6 flex items-center justify-center text-muted-foreground/40">
        <Plus className="h-3.5 w-3.5" />
      </div>

      {/* Title input — aligned with feature row title */}
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Feature name..."
        disabled={isCreating}
        className="flex-1 text-sm bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/50 disabled:opacity-50"
      />

      {/* Auto-chain: icon + switch */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="shrink-0 flex items-center gap-1.5">
            <Link className={cn("h-3.5 w-3.5 transition-colors", chainActive ? "text-primary" : "text-muted-foreground/40")} />
            <Switch
              size="sm"
              checked={chainActive}
              onCheckedChange={setChainActive}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={4}>
          {chainActive ? "Auto-chain on" : "Auto-chain off"}
        </TooltipContent>
      </Tooltip>

      {/* Create button */}
      <button
        type="button"
        onClick={handleCreate}
        disabled={!title.trim() || isCreating}
        className="shrink-0 h-6 px-2 flex items-center gap-1 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isCreating ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <>
            <Plus className="h-3 w-3" />
            <span className="hidden sm:inline">Create</span>
          </>
        )}
      </button>
    </div>
  );
}
