"use client";

import { useSearchParams } from "next/navigation";
import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { AppHeader, type TabId, type CreateAction } from "@/components/app-header";
import {
  DrilldownProvider,
  useDrilldown,
} from "@/components/drilldown/drilldown-context";
import { DrilldownStack } from "@/components/drilldown/drilldown-stack";
import { DashboardTab } from "@/components/tabs/dashboard-tab";
import { FeaturesTab } from "@/components/tabs/features-tab";
import { TimelineTab } from "@/components/tabs/timeline-tab";
import { CalendarTab } from "@/components/tabs/calendar-tab";
import {
  SettingsDialog,
  type SettingsSection,
} from "@/components/settings/settings-panel";
import { useProjects } from "@/hooks/use-milestones";
import { cn } from "@/lib/utils";
import { WorkspaceDeletionBanner } from "@/components/workspace-deletion-banner";

const VALID_TABS: TabId[] = ["dashboard", "features", "timeline", "calendar"];
const VALID_SETTINGS_SECTIONS: SettingsSection[] = [
  "profile",
  "preferences",
  "teams",
  "members",
  "workspace",
];

function DashboardMain({
  activeTab,
  mountedTabs,
  createIntent,
  createType,
  selectedMilestoneId,
  onMilestoneChange,
}: {
  activeTab: TabId;
  mountedTabs: Set<TabId>;
  createIntent: number;
  createType: CreateAction;
  selectedMilestoneId: string | null;
  onMilestoneChange: (id: string | null) => void;
}) {
  const { panels, popAll } = useDrilldown();
  const depth = panels.length;

  // Hide scrollbar while drilldown is open; show only after close animation finishes
  const [hideScroll, setHideScroll] = useState(false);
  const prevDepth = useRef(depth);
  useEffect(() => {
    if (depth > 0) {
      setHideScroll(true);
    } else if (prevDepth.current > 0) {
      // Depth went from >0 to 0 — wait for the 300ms slide-back animation
      const timer = setTimeout(() => setHideScroll(false), 300);
      prevDepth.current = depth;
      return () => clearTimeout(timer);
    }
    prevDepth.current = depth;
  }, [depth]);

  // Close all drilldown panels when the active tab changes
  const prevTab = useRef(activeTab);
  useEffect(() => {
    if (activeTab !== prevTab.current) {
      prevTab.current = activeTab;
      popAll();
    }
  }, [activeTab, popAll]);

  return (
    <main className="flex-1 relative overflow-hidden">
      {/* Tab content area — slides left like Dougly's Panel 0 when drilldown opens */}
      <div
        data-drilldown-bg={depth > 0 ? "" : undefined}
        data-hide-scroll={hideScroll || undefined}
        className={cn(
          "absolute inset-0 transition-all duration-300 ease-out",
          // No panels open — normal position
          depth === 0 && "translate-x-0 opacity-100",
          // 1 panel open — hide on mobile, slide left on desktop
          depth === 1 &&
            "max-md:opacity-0 max-md:pointer-events-none -translate-x-full md:-translate-x-[900px] blur-[2px] md:opacity-50",
          // 2 panels open — hide on mobile, further left on desktop
          depth === 2 &&
            "max-md:opacity-0 max-md:pointer-events-none -translate-x-[200%] md:-translate-x-[1800px] blur-[2px] md:opacity-30",
          // 3+ panels — hide on mobile, furthest back on desktop
          depth >= 3 &&
            "max-md:opacity-0 max-md:pointer-events-none -translate-x-[300%] md:-translate-x-[2700px] blur-[2px] md:opacity-20"
        )}
      >
        {/* Keep-alive tab panels — uses visibility:hidden to preserve DOM + scroll state */}
        <div
          className={cn(
            "absolute inset-0 flex flex-col",
            activeTab !== "dashboard" && "invisible opacity-0 pointer-events-none"
          )}
        >
          {mountedTabs.has("dashboard") && (
            <DashboardTab
              selectedMilestoneId={selectedMilestoneId}
              onMilestoneChange={onMilestoneChange}
            />
          )}
        </div>
        <div
          className={cn(
            "absolute inset-0 flex flex-col",
            activeTab !== "features" && "invisible opacity-0 pointer-events-none"
          )}
        >
          {mountedTabs.has("features") && (
            <FeaturesTab
              createIntent={activeTab === "features" ? createIntent : 0}
              createType={createType}
            />
          )}
        </div>
        <div
          className={cn(
            "absolute inset-0 flex flex-col",
            activeTab !== "timeline" && "invisible opacity-0 pointer-events-none"
          )}
        >
          {mountedTabs.has("timeline") && (
            <TimelineTab
              selectedMilestoneId={selectedMilestoneId}
              onMilestoneChange={onMilestoneChange}
              isActive={activeTab === "timeline"}
            />
          )}
        </div>
        <div
          className={cn(
            "absolute inset-0 flex flex-col",
            activeTab !== "calendar" && "invisible opacity-0 pointer-events-none"
          )}
        >
          {mountedTabs.has("calendar") && <CalendarTab isActive={activeTab === "calendar"} />}
        </div>
      </div>

      <DrilldownStack />
    </main>
  );
}

function DashboardContentInner() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as TabId | null;
  const initialTab: TabId =
    tabParam && VALID_TABS.includes(tabParam) ? tabParam : "dashboard";
  const milestoneId = searchParams.get("milestone");

  // Settings overlay state
  const settingsParam = searchParams.get("settings") as SettingsSection | null;
  const initialSettings: SettingsSection | null =
    settingsParam && VALID_SETTINGS_SECTIONS.includes(settingsParam)
      ? settingsParam
      : null;

  const [settingsSection, setSettingsSection] =
    useState<SettingsSection>(initialSettings ?? "profile");
  const [settingsOpen, setSettingsOpen] = useState(initialSettings !== null);

  // Local state for instant tab switching (bypasses Next.js router overhead)
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  // Shared milestone selection — synced between Dashboard and Timeline tabs
  // Persisted via ?milestone= URL param so it survives page refreshes
  const [selectedMilestoneId, setSelectedMilestoneIdRaw] = useState<string | null>(milestoneId);

  const { data: projectsData } = useProjects();
  const projects = projectsData?.projects ?? [];

  // Validate selection: if selected milestone no longer exists (deleted), fall back
  // Also auto-select first milestone when none is selected and projects are loaded
  useEffect(() => {
    if (projects.length === 0) return;
    if (!selectedMilestoneId || !projects.some((p) => p.id === selectedMilestoneId)) {
      const fallback = projects[0].id;
      setSelectedMilestoneIdRaw(fallback);
      // Sync URL so the fallback persists across refreshes
      const url = new URL(window.location.href);
      url.searchParams.set("milestone", fallback);
      window.history.replaceState(null, "", url.toString());
    }
  }, [projects, selectedMilestoneId]);

  // Persist milestone selection to URL
  const handleMilestoneChange = useCallback((id: string | null) => {
    setSelectedMilestoneIdRaw(id);
    const url = new URL(window.location.href);
    if (id) {
      url.searchParams.set("milestone", id);
    } else {
      url.searchParams.delete("milestone");
    }
    window.history.replaceState(null, "", url.toString());
  }, []);

  // Mount-once-keep-alive: only mount a tab when first visited, then keep it alive
  const [mountedTabs, setMountedTabs] = useState<Set<TabId>>(
    () => new Set([initialTab])
  );

  // Trigger for "create" action from header — incremented to signal tabs
  const [createIntent, setCreateIntent] = useState(0);
  const [createType, setCreateType] = useState<CreateAction>("feature");

  // Controlled create-popover state (shared with AppHeader for global hotkey)
  const [createOpen, setCreateOpen] = useState(false);

  // Sync with external URL changes (e.g., middleware redirects, deep links)
  useEffect(() => {
    const urlTab = searchParams.get("tab") as TabId | null;
    if (urlTab && VALID_TABS.includes(urlTab) && urlTab !== activeTab) {
      setActiveTab(urlTab);
      setMountedTabs((prev) => {
        if (prev.has(urlTab)) return prev;
        const next = new Set(prev);
        next.add(urlTab);
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Preload timeline + calendar bundles so they're cached before user visits the tab
  useEffect(() => {
    import("@/components/timeline/timeline-view");
    import("@/components/calendar/calendar-view");
  }, []);

  // --- Settings dialog handlers ---

  const handleOpenSettings = useCallback((section: SettingsSection) => {
    setSettingsSection(section);
    setSettingsOpen(true);
    // Push a history entry so browser back closes settings
    const url = new URL(window.location.href);
    url.searchParams.set("settings", section);
    window.history.pushState({ settings: section }, "", url.toString());
  }, []);

  const handleSettingsOpenChange = useCallback((open: boolean) => {
    setSettingsOpen(open);
    if (!open) {
      // Remove ?settings= from URL
      const url = new URL(window.location.href);
      url.searchParams.delete("settings");
      window.history.replaceState(null, "", url.toString());
    }
  }, []);

  const handleSettingsSectionChange = useCallback(
    (section: SettingsSection) => {
      setSettingsSection(section);
      // Update URL without new history entry
      const url = new URL(window.location.href);
      url.searchParams.set("settings", section);
      window.history.replaceState(null, "", url.toString());
    },
    []
  );

  // Handle browser back/forward
  useEffect(() => {
    const onPopState = () => {
      const url = new URL(window.location.href);
      const s = url.searchParams.get("settings") as SettingsSection | null;
      if (s && VALID_SETTINGS_SECTIONS.includes(s)) {
        setSettingsSection(s);
        setSettingsOpen(true);
      } else if (settingsOpen) {
        setSettingsOpen(false);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [settingsOpen]);

  // --- Tab handlers ---

  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab(tab);
    setMountedTabs((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
    // Sync URL without triggering Next.js router navigation
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState(null, "", url.toString());
  }, []);

  const handleCreateAction = useCallback(
    (type: CreateAction) => {
      handleTabChange("features");
      setCreateType(type);
      // Use setTimeout so the tab switch mounts/activates before the intent fires
      setTimeout(() => setCreateIntent((n) => n + 1), 0);
    },
    [handleTabChange]
  );

  // Skip transition on initial mount so settings doesn't cause a shift on refresh
  const [transitionReady, setTransitionReady] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => setTransitionReady(true));
  }, []);

  // Global hotkey: C opens create popover (M/F handled inside AppHeader)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;

      if (e.key === "c") {
        e.preventDefault();
        setCreateOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <DrilldownProvider>
      <div
        className={cn(
          "flex flex-col h-svh origin-top",
          transitionReady && "transition-[transform,filter] duration-300 ease-out",
          settingsOpen && "scale-[0.97] blur-[2px]"
        )}
      >
        <WorkspaceDeletionBanner />
        <AppHeader
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onCreateAction={handleCreateAction}
          onOpenSettings={handleOpenSettings}
          createOpen={createOpen}
          onCreateOpenChange={setCreateOpen}
        />
        <DashboardMain
          activeTab={activeTab}
          mountedTabs={mountedTabs}
          createIntent={createIntent}
          createType={createType}
          selectedMilestoneId={selectedMilestoneId}
          onMilestoneChange={handleMilestoneChange}
        />
      </div>

      {/* Settings dialog */}
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={handleSettingsOpenChange}
        activeSection={settingsSection}
        onSectionChange={handleSettingsSectionChange}
      />
    </DrilldownProvider>
  );
}

export function DashboardContent() {
  return (
    <Suspense>
      <DashboardContentInner />
    </Suspense>
  );
}
