"use client";

import * as React from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import type { SettingsSection } from "@/components/settings/settings-panel";
import {
  LogOut,
  User,
  SlidersHorizontal,
  Check,
  Moon,
  Sun,
  Monitor,
  Users,
  ShieldCheck,
} from "lucide-react";
import { usePreferencesStore } from "@/store/preferences-store";
import { useThemeStore } from "@/store/theme-store";
import { useMembers } from "@/hooks/use-members";
import { themePresets } from "@/config/theme-presets";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

interface HeaderUserMenuProps {
  onOpenSettings?: (section: SettingsSection) => void;
}

export function HeaderUserMenu({ onOpenSettings }: HeaderUserMenuProps) {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const { showDisplayName } = usePreferencesStore();
  const { currentPresetKey, mode, setPreset, setMode, getResolvedMode } = useThemeStore();
  const { data: membersData } = useMembers();
  const isAdmin = membersData?.currentUserRole === "admin";
  const resolvedMode = getResolvedMode();
  const sortedThemes = getSortedThemeEntries();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!mounted || !isLoaded || !user) {
    return <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />;
  }

  const initials =
    user.firstName && user.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`
      : user.firstName?.[0] ||
        user.emailAddresses[0]?.emailAddress[0]?.toUpperCase() ||
        "U";

  const customDisplayName = user.unsafeMetadata?.displayName as
    | string
    | undefined;
  const displayName =
    showDisplayName && customDisplayName
      ? customDisplayName
      : user.fullName || user.firstName || "User";
  const email = user.primaryEmailAddress?.emailAddress || "";

  const ModeIcon = mode === "light" ? Sun : mode === "dark" ? Moon : Monitor;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8 rounded-full">
            {user.hasImage && <AvatarImage src={user.imageUrl} alt={displayName} />}
            <AvatarFallback className="rounded-full text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 rounded-lg" align="end" sideOffset={8}>
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-2 py-1.5 text-left text-sm">
            <Avatar className="h-8 w-8 rounded-full">
              {user.hasImage && <AvatarImage src={user.imageUrl} alt={displayName} />}
              <AvatarFallback className="rounded-full text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{displayName}</span>
              <span className="truncate text-xs text-muted-foreground">
                {email}
              </span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => onOpenSettings?.("profile")}>
            <User />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onOpenSettings?.("preferences")}>
            <SlidersHorizontal />
            Preferences
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <ModeIcon />
              Theme
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-64 max-h-80 overflow-y-auto">
              {/* Mode toggle */}
              <div className="p-1.5 border-b">
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
                          "flex-1 gap-1.5 h-7",
                          isActive && "bg-accent"
                        )}
                        onClick={() => setMode(option.value)}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span className="text-xs">{option.label}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Theme presets */}
              {sortedThemes.map(([key, preset]) => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => setPreset(key)}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3.5 w-3.5 rounded-full border shrink-0"
                      style={{
                        backgroundColor: preset.styles[resolvedMode].primary,
                      }}
                    />
                    <span className="text-sm">{preset.label}</span>
                  </div>
                  {currentPresetKey === key && (
                    <Check className="h-3.5 w-3.5 shrink-0" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => onOpenSettings?.("teams")}>
            <Users />
            Teams
          </DropdownMenuItem>
          {isAdmin && (
            <DropdownMenuItem onClick={() => onOpenSettings?.("members")}>
              <ShieldCheck />
              Members
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => signOut({ redirectUrl: "/" })}
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
