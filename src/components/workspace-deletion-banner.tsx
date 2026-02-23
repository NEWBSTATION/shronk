"use client";

import { useState, useEffect, useRef } from "react";
import { Angry, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { useCancelWorkspaceDeletion } from "@/hooks/use-workspaces";

function getTimeRemaining(deletionScheduledAt: string) {
  const deletionDate = new Date(deletionScheduledAt);
  deletionDate.setDate(deletionDate.getDate() + 30);
  const ms = Math.max(0, deletionDate.getTime() - Date.now());
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  return { days, hours, minutes };
}

export function WorkspaceDeletionBanner() {
  const { workspaceId, isOwner, deletionScheduledAt } = useWorkspace();
  const cancelDeletion = useCancelWorkspaceDeletion();
  const [time, setTime] = useState(() =>
    deletionScheduledAt ? getTimeRemaining(deletionScheduledAt) : null
  );
  const [dismissed, setDismissed] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);

  // Animate in on mount
  useEffect(() => {
    const el = bannerRef.current;
    if (!el || !deletionScheduledAt) return;
    el.style.height = "0px";
    el.style.opacity = "0";
    el.offsetHeight; // force reflow
    el.style.transition = "height 300ms ease, opacity 300ms ease";
    el.style.height = `${el.scrollHeight}px`;
    el.style.opacity = "1";
    const cleanup = () => { el.style.height = ""; el.style.transition = ""; };
    el.addEventListener("transitionend", cleanup, { once: true });
    return () => el.removeEventListener("transitionend", cleanup);
  }, [deletionScheduledAt]);

  useEffect(() => {
    if (!deletionScheduledAt) return;
    const id = setInterval(() => setTime(getTimeRemaining(deletionScheduledAt)), 60_000);
    return () => clearInterval(id);
  }, [deletionScheduledAt]);

  if (!deletionScheduledAt || !time || dismissed) return null;

  const handleCancel = async () => {
    try {
      await cancelDeletion.mutateAsync(workspaceId);
      toast.success("Workspace deletion cancelled");

      const el = bannerRef.current;
      if (el) {
        const h = el.offsetHeight;
        el.style.height = `${h}px`;
        // Force reflow before transitioning
        el.offsetHeight;
        el.style.transition = "height 300ms ease, opacity 300ms ease";
        el.style.height = "0px";
        el.style.opacity = "0";
        el.addEventListener("transitionend", () => setDismissed(true), { once: true });
      } else {
        setDismissed(true);
      }
    } catch {
      toast.error("Failed to cancel deletion");
    }
  };

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div ref={bannerRef} className="relative overflow-hidden border-b border-destructive/30 bg-destructive/5 text-destructive text-sm">
      <div className="deletion-banner-stripes absolute inset-0" />
      <div className="relative flex items-center gap-2 px-4 py-2">
        <Angry className="h-4 w-4 shrink-0" />
        <p className="flex-1 min-w-0">
          This workspace will be deleted in{" "}
          <span className="font-mono font-medium tabular-nums">
            {time.days}d {pad(time.hours)}h {pad(time.minutes)}m
          </span>
        </p>
        {isOwner && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            disabled={cancelDeletion.isPending}
            className="shrink-0 bg-background/80 text-destructive hover:text-destructive hover:bg-background h-7 px-2 text-xs font-medium"
          >
            {cancelDeletion.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            Cancel deletion
          </Button>
        )}
      </div>
    </div>
  );
}
