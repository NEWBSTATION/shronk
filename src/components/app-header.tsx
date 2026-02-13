"use client";

import { Gem, Box, ChartGantt, Plus, ChartPie, CalendarDays } from "lucide-react";
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
import type { SettingsSection } from "@/components/settings/settings-panel";
import { cn } from "@/lib/utils";
import { useState, useRef, useCallback, useEffect, useLayoutEffect } from "react";

export type TabId = "dashboard" | "features" | "timeline" | "calendar";
export type CreateAction = "milestone" | "feature";

const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Dashboard", icon: ChartPie },
  { id: "features", label: "Features", icon: Box },
  { id: "timeline", label: "Timeline", icon: ChartGantt },
  // { id: "calendar", label: "Calendar", icon: CalendarDays },
];

const createOptions: { type: CreateAction; label: string; icon: React.ElementType; shortcutKey: string }[] = [
  { type: "milestone", label: "Milestone", icon: Gem, shortcutKey: "M" },
  { type: "feature", label: "Feature", icon: Box, shortcutKey: "F" },
];

interface AppHeaderProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onCreateAction?: (type: CreateAction) => void;
  onOpenSettings?: (section: SettingsSection) => void;
  createOpen?: boolean;
  onCreateOpenChange?: (open: boolean) => void;
}

function useMagnetic(strength = 0.3, radius = 100) {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!ref.current) return;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const rect = ref.current!.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < radius) {
          const pull = 1 - dist / radius;
          setOffset({ x: dx * strength * pull, y: dy * strength * pull });
        } else {
          setOffset((prev) => (prev.x === 0 && prev.y === 0 ? prev : { x: 0, y: 0 }));
        }
      });
    },
    [strength, radius]
  );

  const handleMouseLeave = useCallback(() => {
    setOffset((prev) => (prev.x === 0 && prev.y === 0 ? prev : { x: 0, y: 0 }));
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(rafRef.current);
    };
  }, [handleMouseMove, handleMouseLeave]);

  return { ref, style: { transform: `translate(${offset.x}px, ${offset.y}px)`, transition: offset.x === 0 && offset.y === 0 ? "transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)" : "transform 0.15s ease-out" } as const };
}

export function AppHeader({ activeTab, onTabChange, onCreateAction, onOpenSettings, createOpen: createOpenProp, onCreateOpenChange }: AppHeaderProps) {
  // Support both controlled (from layout) and uncontrolled (standalone) usage
  const [createOpenLocal, setCreateOpenLocal] = useState(false);
  const createOpen = createOpenProp ?? createOpenLocal;
  const setCreateOpen = onCreateOpenChange ?? setCreateOpenLocal;
  const magnetic = useMagnetic(0.3, 100);

  // When popover is open, M/F keys trigger create actions
  useEffect(() => {
    if (!createOpen) return;
    const handler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "m" || key === "f") {
        e.preventDefault();
        e.stopImmediatePropagation(); // Prevent timeline F handler from also firing
        setCreateOpen(false);
        onCreateAction?.(key === "m" ? "milestone" : "feature");
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [createOpen, setCreateOpen, onCreateAction]);

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const indicatorRef = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useLayoutEffect(() => {
    const indicator = indicatorRef.current;
    const button = buttonRefs.current[activeTab];
    if (!indicator || !button) return;

    const left = `${button.offsetLeft}px`;
    const width = `${button.offsetWidth}px`;

    if (!hasAnimated.current) {
      indicator.style.left = left;
      indicator.style.width = width;
      hasAnimated.current = true;
      return;
    }

    // 1. Kill any in-flight transition so the browser commits the current position
    indicator.style.transition = "none";
    // 2. Force synchronous reflow — browser now knows "no transition, position = current"
    void indicator.getBoundingClientRect();
    // 3. Set transition + new target — browser animates from committed position to target
    indicator.style.transition =
      "left 500ms cubic-bezier(0.16, 1, 0.3, 1), width 500ms cubic-bezier(0.16, 1, 0.3, 1)";
    indicator.style.left = left;
    indicator.style.width = width;
  }, [activeTab]);

  return (
    <header className="flex shrink-0 items-center bg-background px-6 py-6 relative z-10 after:pointer-events-none after:absolute after:left-0 after:right-0 after:top-full after:h-6 after:bg-gradient-to-b after:from-background after:to-transparent">
      {/* Left: Logo */}
      <div className="flex-1 flex items-center">
        <div
          ref={magnetic.ref}
          style={magnetic.style}
          className="flex items-center gap-1.5 cursor-pointer"
          onClick={() => onTabChange("dashboard")}
        >
          <Image src="/orc-head.svg" alt="Shronk" width={20} height={20} className="dark:invert-0 invert" />
          <span className="text-base" style={{ fontFamily: "Silkscreen, cursive" }}>Shronk</span>
        </div>
      </div>

      {/* Center: Tab pills + create button */}
      <div className="flex justify-center">
        <TooltipProvider delayDuration={300}>
          <div className="flex items-center gap-2">
            <div ref={containerRef} className="relative inline-flex items-center gap-1 rounded-2xl bg-muted p-1">
              <div
                ref={indicatorRef}
                className="absolute top-1 bottom-1 rounded-xl bg-background shadow-sm pointer-events-none"
              />
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    ref={(el) => { buttonRefs.current[tab.id] = el; }}
                    onClick={() => onTabChange(tab.id)}
                    className={cn(
                      "relative z-[1] flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-medium transition-colors duration-200",
                      isActive
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {tab.label}
                  </button>
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
                    <span className="flex items-center gap-1.5">Create <kbd className="text-[11px] font-mono text-background/40 bg-background/10 px-1 py-0.5 rounded">C</kbd></span>
                  </TooltipContent>
                </Tooltip>
                <PopoverContent
                  side="bottom"
                  align="start"
                  sideOffset={8}
                  className="w-40 p-1"
                >
                  <p className="px-2.5 py-1.5 text-xs font-medium text-muted-foreground">Create new</p>
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
                        <span className="flex-1 text-left">{option.label}</span>
                        <kbd className="ml-auto text-[11px] font-mono text-muted-foreground/50">{option.shortcutKey}</kbd>
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
        <HeaderUserMenu onOpenSettings={onOpenSettings} />
      </div>
    </header>
  );
}
