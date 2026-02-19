"use client";

import * as React from "react";
import { Check, Dices, Moon, Sun, Monitor, Palette } from "lucide-react";
import { useThemeStore } from "@/store/theme-store";
import { themePresets } from "@/config/theme-presets";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ThemeMode } from "@/types/theme";

/**
 * Combined Theme & Mode Selector Component
 *
 * This component provides a unified UI for selecting:
 * 1. Color mode (Light, Dark, System)
 * 2. Theme presets from tweakcn
 *
 * Features:
 * - Searchable theme list
 * - Sticky mode selection header
 * - Color preview for each theme
 */

// Get sorted theme entries: "default" first, then alphabetically by label
function getSortedThemeEntries() {
  const entries = Object.entries(themePresets);
  const defaultEntry = entries.find(([key]) => key === "default");
  const otherEntries = entries.filter(([key]) => key !== "default");
  otherEntries.sort((a, b) => a[1].label.localeCompare(b[1].label));
  return defaultEntry ? [defaultEntry, ...otherEntries] : otherEntries;
}

const modeOptions: { value: ThemeMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function ThemeSelector() {
  const { currentPresetKey, mode, setPreset, setMode, getResolvedMode, randomPreset } = useThemeStore();
  const [open, setOpen] = React.useState(false);
  const sortedThemes = getSortedThemeEntries();
  const resolvedMode = getResolvedMode();

  return (
    <div className="px-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            role="combobox"
            aria-expanded={open}
          >
            <Palette className="h-4 w-4" />
            <span className="truncate">
              {themePresets[currentPresetKey]?.label || "Select Theme"}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            {/* Sticky Mode Selection Header */}
            <div className="sticky top-0 z-10 bg-popover border-b">
              <div className="p-2 space-y-1.5">
                <div className="flex gap-1">
                  {modeOptions.map((option) => {
                    const Icon = option.icon;
                    const isActive = mode === option.value;
                    return (
                      <Button
                        key={option.value}
                        variant={isActive ? "secondary" : "ghost"}
                        size="sm"
                        className={cn(
                          "flex-1 gap-1.5",
                          isActive && "bg-accent text-accent-foreground"
                        )}
                        onClick={() => setMode(option.value)}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="text-xs">{option.label}</span>
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between gap-1.5 text-muted-foreground"
                  onClick={() => randomPreset()}
                >
                  <span className="flex items-center gap-1.5">
                    <Dices className="h-3.5 w-3.5" />
                    <span className="text-xs">Random theme</span>
                  </span>
                  <kbd className="text-[10px] rounded bg-muted px-1.5 py-0.5 font-medium text-muted-foreground/60">
                    {typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent) ? "⌘\\" : "Ctrl+\\"}
                  </kbd>
                </Button>
              </div>
              <CommandInput placeholder="Search themes..." />
            </div>

            {/* Scrollable Theme List */}
            <CommandList className="max-h-[280px]">
              <CommandEmpty>No theme found.</CommandEmpty>
              <CommandGroup heading="Themes">
                {sortedThemes.map(([key, preset]) => (
                  <CommandItem
                    key={key}
                    value={preset.label}
                    onSelect={() => {
                      setPreset(key);
                      setOpen(false);
                    }}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="h-4 w-4 rounded-full border shrink-0"
                        style={{
                          backgroundColor: preset.styles[resolvedMode].primary,
                        }}
                      />
                      <span>{preset.label}</span>
                    </div>
                    {currentPresetKey === key && (
                      <Check className="h-4 w-4 shrink-0" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function ThemeSelectorCompact() {
  const { currentPresetKey, mode, setPreset, setMode, getResolvedMode, randomPreset } = useThemeStore();
  const [open, setOpen] = React.useState(false);
  const sortedThemes = getSortedThemeEntries();
  const resolvedMode = getResolvedMode();

  // Get the appropriate icon for current mode
  const ModeIcon = mode === "light" ? Sun : mode === "dark" ? Moon : Monitor;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          role="combobox"
          aria-expanded={open}
        >
          <ModeIcon className="h-4 w-4" />
          <span className="sr-only">Theme settings</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="end">
        <Command>
          {/* Sticky Mode Selection Header */}
          <div className="sticky top-0 z-10 bg-popover border-b">
            <div className="p-2 space-y-1.5">
              <div className="flex gap-1">
                {modeOptions.map((option) => {
                  const Icon = option.icon;
                  const isActive = mode === option.value;
                  return (
                    <Button
                      key={option.value}
                      variant={isActive ? "secondary" : "ghost"}
                      size="sm"
                      className={cn(
                        "flex-1 gap-1.5",
                        isActive && "bg-accent text-accent-foreground"
                      )}
                      onClick={() => setMode(option.value)}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-xs">{option.label}</span>
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between gap-1.5 text-muted-foreground"
                onClick={() => randomPreset()}
              >
                <span className="flex items-center gap-1.5">
                  <Dices className="h-3.5 w-3.5" />
                  <span className="text-xs">Random theme</span>
                </span>
                <kbd className="text-[10px] rounded bg-muted px-1.5 py-0.5 font-medium text-muted-foreground/60">
                  {typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent) ? "⌘⇧R" : "Ctrl+Shift+R"}
                </kbd>
              </Button>
            </div>
            <CommandInput placeholder="Search themes..." />
          </div>

          {/* Scrollable Theme List */}
          <CommandList className="max-h-[280px]">
            <CommandEmpty>No theme found.</CommandEmpty>
            <CommandGroup heading="Themes">
              {sortedThemes.map(([key, preset]) => (
                <CommandItem
                  key={key}
                  value={preset.label}
                  onSelect={() => {
                    setPreset(key);
                    setOpen(false);
                  }}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="h-4 w-4 rounded-full border shrink-0"
                      style={{
                        backgroundColor: preset.styles[resolvedMode].primary,
                      }}
                    />
                    <span>{preset.label}</span>
                  </div>
                  {currentPresetKey === key && (
                    <Check className="h-4 w-4 shrink-0" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
