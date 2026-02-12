"use client";

import { Gem, Box, ChartGantt, Settings, Plus, Gauge } from "lucide-react";
import Image from "next/image";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { HeaderUserMenu } from "@/components/header-user-menu";
import { cn } from "@/lib/utils";
import { useState } from "react";

export type TabId = "dashboard" | "features" | "timeline" | "settings";
export type CreateAction = "milestone" | "feature";

const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Dashboard", icon: Gauge },
  { id: "features", label: "Features", icon: Gem },
  { id: "timeline", label: "Timeline", icon: ChartGantt },
  { id: "settings", label: "Settings", icon: Settings },
];

const createOptions: { type: CreateAction; label: string; icon: React.ElementType }[] = [
  { type: "milestone", label: "Milestone", icon: Gem },
  { type: "feature", label: "Feature", icon: Box },
];

interface AppHeaderProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onCreateAction?: (type: CreateAction) => void;
  onNavigateSettings?: (subTab: string) => void;
}

export function AppHeader({ activeTab, onTabChange, onCreateAction, onNavigateSettings }: AppHeaderProps) {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <header className="flex shrink-0 items-center bg-background px-6 py-6">
      {/* Left: Logo */}
      <div className="flex-1 flex items-center gap-1.5">
        <Image src="/orc-head.svg" alt="Shronk" width={20} height={20} className="dark:invert-0 invert" />
        <span className="text-base" style={{ fontFamily: "Silkscreen, cursive" }}>Shronk</span>
      </div>

      {/* Center: Tab pills + create button */}
      <div className="flex justify-center">
        <TooltipProvider delayDuration={300}>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-2xl bg-muted p-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <Tooltip key={tab.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onTabChange(tab.id)}
                        className={cn(
                          "flex items-center justify-center gap-1.5 h-8 rounded-xl transition-all",
                          isActive
                            ? "bg-background text-foreground shadow-sm px-3"
                            : "text-muted-foreground hover:text-foreground hover:bg-background/50 w-8"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {isActive && (
                          <span className="text-xs font-medium">{tab.label}</span>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={8}>
                      {tab.label}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>

            {/* Detached create button — same glass container as tabs */}
            <div className="inline-flex items-center rounded-2xl bg-muted p-1">
              <Popover open={createOpen} onOpenChange={setCreateOpen}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <button
                        className="flex items-center justify-center h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-background/50 transition-all"
                        suppressHydrationWarning
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={8}>
                    Create
                  </TooltipContent>
                </Tooltip>
                <PopoverContent
                  side="bottom"
                  align="center"
                  sideOffset={8}
                  className="w-40 p-1"
                >
                  {createOptions.map((option) => {
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.type}
                        onClick={() => {
                          setCreateOpen(false);
                          onCreateAction?.(option.type);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                      >
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        {option.label}
                      </button>
                    );
                  })}
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </TooltipProvider>
      </div>

      {/* Right: User menu */}
      <div className="flex-1 flex justify-end">
        <HeaderUserMenu onNavigateSettings={onNavigateSettings} />
      </div>
    </header>
  );
}
