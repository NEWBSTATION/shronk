"use client";

import { useEffect, useRef } from "react";
import { useDrilldown } from "./drilldown-context";
import { useProjects } from "@/hooks/use-milestones";
import { MilestoneDetailPanel } from "./panels/milestone-detail-panel";
import { RestoredFeaturePanel } from "./restored-feature-panel";

/**
 * Syncs the top drilldown panel's ID to `?detail=` URL param and
 * restores the panel on page load / refresh.
 *
 * Must be rendered inside <DrilldownProvider>.
 */
export function DrilldownRestorer() {
  const { panels, push } = useDrilldown();

  // Read the initial URL param once, synchronously during first render.
  const initialDetailRef = useRef<string | null | undefined>(undefined);
  if (initialDetailRef.current === undefined) {
    initialDetailRef.current =
      typeof window !== "undefined"
        ? new URL(window.location.href).searchParams.get("detail")
        : null;
  }

  // Two-phase gate:
  // pushSent — set synchronously to prevent duplicate push() calls
  // syncReady — set via RAF after push lands in state, gates URL sync
  const pushSent = useRef(false);
  const syncReady = useRef(!initialDetailRef.current);

  const { data: projectsData } = useProjects();

  // Restore panel from URL on mount
  useEffect(() => {
    if (pushSent.current || syncReady.current) return;
    const detail = initialDetailRef.current;
    if (!detail) {
      syncReady.current = true;
      return;
    }

    let didPush = false;

    if (detail.startsWith("milestone-")) {
      const projectId = detail.replace("milestone-", "");
      const project = projectsData?.projects?.find((p) => p.id === projectId);
      if (!project) return; // Wait for projects to load
      push(detail, <MilestoneDetailPanel milestone={project} />);
      didPush = true;
    } else if (detail.startsWith("feature-")) {
      const featureId = detail.replace("feature-", "");
      push(detail, <RestoredFeaturePanel featureId={featureId} />);
      didPush = true;
    }

    pushSent.current = true;

    if (didPush) {
      // Enable sync after the pushed panel has landed in React state
      requestAnimationFrame(() => {
        syncReady.current = true;
      });
    } else {
      syncReady.current = true;
    }
  }, [projectsData, push]);

  // Sync active panel to URL.
  // Gated by syncReady so we don't clear ?detail= before push lands.
  useEffect(() => {
    if (!syncReady.current) return;

    const id = requestAnimationFrame(() => {
      const url = new URL(window.location.href);
      const topPanel = panels[panels.length - 1];
      if (topPanel) {
        url.searchParams.set("detail", topPanel.id);
      } else {
        url.searchParams.delete("detail");
      }
      window.history.replaceState(null, "", url.toString());
    });
    return () => cancelAnimationFrame(id);
  }, [panels]);

  return null;
}
