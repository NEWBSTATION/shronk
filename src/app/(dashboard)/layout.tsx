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
import { SettingsTab } from "@/components/tabs/settings-tab";
import { cn } from "@/lib/utils";

const VALID_TABS: TabId[] = ["dashboard", "features", "timeline", "settings"];

function DashboardMain({
  activeTab,
  mountedTabs,
  milestoneId,
  createIntent,
  createType,
  settingsSubTab,
}: {
  activeTab: TabId;
  mountedTabs: Set<TabId>;
  milestoneId: string | null;
  createIntent: number;
  createType: CreateAction;
  settingsSubTab: string;
}) {
  const { panels, popAll } = useDrilldown();
  const depth = panels.length;

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
        className={cn(
          "absolute inset-0 transition-all duration-300 ease-out",
          // No panels open — normal position
          depth === 0 && "translate-x-0 opacity-100",
          // 1 panel open — slide left, blur, dim
          depth === 1 &&
            "-translate-x-full md:-translate-x-[900px] blur-[2px] opacity-50",
          // 2 panels open — further left, more dim
          depth === 2 &&
            "-translate-x-[200%] md:-translate-x-[1800px] blur-[2px] opacity-30",
          // 3+ panels — furthest back
          depth >= 3 &&
            "-translate-x-[300%] md:-translate-x-[2700px] blur-[2px] opacity-20"
        )}
      >
        {/* Keep-alive tab panels — uses visibility:hidden to preserve DOM + scroll state */}
        <div
          className={cn(
            "absolute inset-0 flex flex-col",
            activeTab !== "dashboard" && "invisible pointer-events-none"
          )}
        >
          {mountedTabs.has("dashboard") && <DashboardTab />}
        </div>
        <div
          className={cn(
            "absolute inset-0 flex flex-col",
            activeTab !== "features" && "invisible pointer-events-none"
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
            activeTab !== "timeline" && "invisible pointer-events-none"
          )}
        >
          {mountedTabs.has("timeline") && (
            <TimelineTab initialMilestoneId={milestoneId} />
          )}
        </div>
        <div
          className={cn(
            "absolute inset-0 flex flex-col",
            activeTab !== "settings" && "invisible pointer-events-none"
          )}
        >
          {mountedTabs.has("settings") && <SettingsTab subTab={settingsSubTab} />}
        </div>
      </div>

      <DrilldownStack />
    </main>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as TabId | null;
  const initialTab: TabId =
    tabParam && VALID_TABS.includes(tabParam) ? tabParam : "dashboard";
  const milestoneId = searchParams.get("milestone");

  // Local state for instant tab switching (bypasses Next.js router overhead)
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  // Mount-once-keep-alive: only mount a tab when first visited, then keep it alive
  const [mountedTabs, setMountedTabs] = useState<Set<TabId>>(
    () => new Set([initialTab])
  );

  // Trigger for "create" action from header — incremented to signal tabs
  const [createIntent, setCreateIntent] = useState(0);
  const [createType, setCreateType] = useState<CreateAction>("feature");
  const [settingsSubTab, setSettingsSubTab] = useState("profile");

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

  // Preload SVAR timeline bundle so it's cached before user visits the tab
  useEffect(() => {
    import("@/components/timeline/svar-timeline-view");
  }, []);

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

  const handleNavigateSettings = useCallback(
    (subTab: string) => {
      setSettingsSubTab(subTab);
      handleTabChange("settings");
    },
    [handleTabChange]
  );

  const handleCreateAction = useCallback(
    (type: CreateAction) => {
      handleTabChange("features");
      setCreateType(type);
      // Use setTimeout so the tab switch mounts/activates before the intent fires
      setTimeout(() => setCreateIntent((n) => n + 1), 0);
    },
    [handleTabChange]
  );

  return (
    <DrilldownProvider>
      <div className="flex flex-col h-svh">
        <AppHeader activeTab={activeTab} onTabChange={handleTabChange} onCreateAction={handleCreateAction} onNavigateSettings={handleNavigateSettings} />
        <DashboardMain
          activeTab={activeTab}
          mountedTabs={mountedTabs}
          milestoneId={milestoneId}
          createIntent={createIntent}
          createType={createType}
          settingsSubTab={settingsSubTab}
        />
      </div>
    </DrilldownProvider>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  );
}
