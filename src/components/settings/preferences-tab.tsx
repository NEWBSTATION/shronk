"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Sun, Moon, Monitor, Check } from "lucide-react";
import { usePreferencesStore } from "@/store/preferences-store";
import { useThemeStore } from "@/store/theme-store";
import { themePresets } from "@/config/theme-presets";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ThemeMode } from "@/types/theme";

const modeOptions: { value: ThemeMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

function getSortedThemeEntries() {
  const entries = Object.entries(themePresets);
  const defaultEntry = entries.find(([key]) => key === "default");
  const otherEntries = entries.filter(([key]) => key !== "default");
  otherEntries.sort((a, b) => a[1].label.localeCompare(b[1].label));
  return defaultEntry ? [defaultEntry, ...otherEntries] : otherEntries;
}

const TIMEZONE_GROUPS: Record<string, string[]> = {
  "North America": [
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Anchorage",
    "America/Phoenix",
    "America/Toronto",
    "America/Vancouver",
  ],
  Europe: [
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Europe/Madrid",
    "Europe/Rome",
    "Europe/Amsterdam",
    "Europe/Moscow",
  ],
  Asia: [
    "Asia/Tokyo",
    "Asia/Shanghai",
    "Asia/Hong_Kong",
    "Asia/Singapore",
    "Asia/Seoul",
    "Asia/Kolkata",
    "Asia/Dubai",
    "Asia/Bangkok",
  ],
  "Australia & Pacific": [
    "Australia/Sydney",
    "Australia/Melbourne",
    "Australia/Perth",
    "Pacific/Auckland",
    "Pacific/Honolulu",
  ],
  "South America": [
    "America/Sao_Paulo",
    "America/Buenos_Aires",
    "America/Santiago",
    "America/Bogota",
  ],
  Africa: [
    "Africa/Cairo",
    "Africa/Lagos",
    "Africa/Johannesburg",
    "Africa/Nairobi",
  ],
};

function formatTimezone(tz: string) {
  return tz.replace(/_/g, " ").split("/").pop() || tz;
}

const allListedZones = new Set(Object.values(TIMEZONE_GROUPS).flat());

export function PreferencesTab() {
  const { timezone, showDisplayName, setTimezone, setShowDisplayName } =
    usePreferencesStore();
  const { currentPresetKey, mode, setPreset, setMode, getResolvedMode } =
    useThemeStore();
  const resolvedMode = getResolvedMode();
  const sortedThemes = getSortedThemeEntries();
  const [themeSearch, setThemeSearch] = useState("");

  const showDetected = timezone && !allListedZones.has(timezone);

  const filteredThemes = themeSearch
    ? sortedThemes.filter(([, preset]) =>
        preset.label.toLowerCase().includes(themeSearch.toLowerCase())
      )
    : sortedThemes;

  // Scroll fade tracking for theme list
  const themeListRef = useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const updateScrollFades = useCallback(() => {
    const el = themeListRef.current;
    if (!el) return;
    setCanScrollUp(el.scrollTop > 2);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 2);
  }, []);

  useEffect(() => {
    updateScrollFades();
  }, [filteredThemes, updateScrollFades]);

  return (
    <div className="space-y-6">
      {/* Appearance Section */}
      <div>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Appearance
        </h3>
        <div className="rounded-lg border">
          {/* Mode selector */}
          <div className="flex items-center justify-between gap-4 px-4 py-3 border-b">
            <div>
              <Label className="text-sm font-medium">Mode</Label>
              <p className="text-xs text-muted-foreground">
                Choose light, dark, or match your system
              </p>
            </div>
            <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-1">
              {modeOptions.map((option) => {
                const Icon = option.icon;
                const isActive = mode === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => setMode(option.value)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all",
                      isActive
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Theme preset list */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-medium">Theme</Label>
              <Input
                type="text"
                placeholder="Search themes..."
                value={themeSearch}
                onChange={(e) => setThemeSearch(e.target.value)}
                className="h-7 w-40 text-xs"
              />
            </div>
            <div
              ref={themeListRef}
              onScroll={updateScrollFades}
              className={cn(
                "relative max-h-[280px] overflow-y-auto -mx-1 px-1 space-y-0.5",
                (canScrollUp || canScrollDown) && "[mask-image:linear-gradient(to_bottom,var(--fade-top),black_12px,black_calc(100%-12px),var(--fade-bottom))]",
              )}
              style={{
                "--fade-top": canScrollUp ? "transparent" : "black",
                "--fade-bottom": canScrollDown ? "transparent" : "black",
              } as React.CSSProperties}
            >
              {filteredThemes.map(([key, preset]) => {
                const isSelected = currentPresetKey === key;
                const styles = preset.styles[resolvedMode];
                return (
                  <button
                    key={key}
                    onClick={() => setPreset(key)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors",
                      isSelected
                        ? "bg-primary/10 text-foreground"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    <div
                      className="h-4 w-4 rounded-full shrink-0 border border-black/10"
                      style={{ backgroundColor: styles.primary }}
                    />
                    <span className="text-sm flex-1 truncate">{preset.label}</span>
                    {isSelected && (
                      <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                    )}
                  </button>
                );
              })}
              {filteredThemes.length === 0 && (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No themes found
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Display Section */}
      <div>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Display
        </h3>
        <div className="rounded-lg border">
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div>
              <Label htmlFor="show-display-name" className="text-sm font-medium">
                Show display name
              </Label>
              <p className="text-xs text-muted-foreground">
                Use your display name instead of your full name in the sidebar
              </p>
            </div>
            <Switch
              id="show-display-name"
              checked={showDisplayName}
              onCheckedChange={setShowDisplayName}
            />
          </div>
        </div>
      </div>

      {/* Regional Section */}
      <div>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Regional
        </h3>
        <div className="rounded-lg border">
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div>
              <Label htmlFor="timezone" className="text-sm font-medium">
                Timezone
              </Label>
              <p className="text-xs text-muted-foreground">
                Used for displaying dates and times
              </p>
            </div>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="timezone" className="w-48">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {showDetected && (
                  <SelectGroup>
                    <SelectLabel>Detected</SelectLabel>
                    <SelectItem value={timezone}>
                      {formatTimezone(timezone)}
                    </SelectItem>
                  </SelectGroup>
                )}
                {Object.entries(TIMEZONE_GROUPS).map(([group, zones]) => (
                  <SelectGroup key={group}>
                    <SelectLabel>{group}</SelectLabel>
                    {zones.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {formatTimezone(tz)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
