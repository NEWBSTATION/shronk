"use client";

import { IconTarget } from "@tabler/icons-react";
import { Gem, Box, ChartGantt, Settings } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HeaderUserMenu } from "@/components/header-user-menu";
import { cn } from "@/lib/utils";

export type TabId = "milestones" | "features" | "timeline" | "settings";

const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "milestones", label: "Milestones", icon: Gem },
  { id: "features", label: "Features", icon: Box },
  { id: "timeline", label: "Timeline", icon: ChartGantt },
  { id: "settings", label: "Settings", icon: Settings },
];

interface AppHeaderProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function AppHeader({ activeTab, onTabChange }: AppHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center border-b bg-background px-4 lg:px-6">
      {/* Left: Logo */}
      <div className="flex items-center gap-1.5">
        <IconTarget className="!size-5" />
        <span className="text-base font-semibold">Shronk</span>
      </div>

      {/* Center: Tab pills */}
      <div className="flex-1 flex justify-center">
        <TooltipProvider delayDuration={300}>
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
                        "flex items-center justify-center h-8 w-8 rounded-xl transition-all",
                        isActive
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={8}>
                    {tab.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
      </div>

      {/* Right: User menu */}
      <HeaderUserMenu />
    </header>
  );
}
