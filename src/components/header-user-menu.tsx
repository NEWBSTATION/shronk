"use client";

import * as React from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import type { SettingsSection } from "@/components/settings/settings-panel";
import {
  LogOut,
  Settings,
  Check,
  Dices,
  Moon,
  Sun,
  Monitor,
  ShieldCheck,
  Plus,
} from "lucide-react";
import { usePreferencesStore } from "@/store/preferences-store";
import { useThemeStore } from "@/store/theme-store";
import { useMembers } from "@/hooks/use-members";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { useWorkspaces, useSwitchWorkspace } from "@/hooks/use-workspaces";
import { useRouter } from "next/navigation";
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

function stripWorkspaceSuffix(name: string) {
  return name.replace(/\s+workspace$/i, "").trim();
}

interface HeaderUserMenuProps {
  onOpenSettings?: (section: SettingsSection) => void;
}

export function HeaderUserMenu({ onOpenSettings }: HeaderUserMenuProps) {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const { showDisplayName } = usePreferencesStore();
  const { currentPresetKey, mode, setPreset, setMode, getResolvedMode, randomPreset } = useThemeStore();
  const { data: membersData } = useMembers();
  const isAdmin = membersData?.currentUserRole === "admin";
  const { workspaceId, workspaceName } = useWorkspace();
  const { data: workspacesData } = useWorkspaces();
  const switchWorkspace = useSwitchWorkspace();
  const router = useRouter();
  const workspaces = workspacesData?.workspaces ?? [];
  const pendingCount = workspacesData?.pendingInvites?.length ?? 0;
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
        <div className="inline-flex items-center rounded-2xl bg-card border border-border/50 p-1">
          <button className="flex items-center justify-center h-8 w-8 rounded-xl hover:glass-highlight hover:shadow-[0_1px_2px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.7)] dark:hover:shadow-[0_1px_2px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)] transition-all">
            <Avatar className="h-7 w-7 rounded-lg">
              {user.hasImage && <AvatarImage src={user.imageUrl} alt={displayName} />}
              <AvatarFallback className="rounded-lg text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 rounded-lg p-0 overflow-hidden" align="end" sideOffset={8}>
        {/* Upper section — popover bg */}
        <div className="p-1">
          {/* User profile header */}
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex items-center gap-3 px-2 py-2 text-left text-sm">
              <Avatar className="h-9 w-9 rounded-full">
                {user.hasImage && <AvatarImage src={user.imageUrl} alt={displayName} />}
                <AvatarFallback className="rounded-full text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-medium">{displayName}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {email}
                </span>
              </div>
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          {/* Settings + Members */}
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => onOpenSettings?.("profile")}>
              <Settings />
              Settings
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem onClick={() => onOpenSettings?.("members")}>
                <ShieldCheck />
                Manage members
              </DropdownMenuItem>
            )}
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
                            isActive && "bg-accent text-accent-foreground"
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

                {/* Randomize + Theme presets */}
                <DropdownMenuItem
                  onClick={() => randomPreset()}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Dices className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-sm">Randomize</span>
                  </div>
                  <kbd className="text-[10px] rounded bg-muted px-1.5 py-0.5 font-medium text-muted-foreground/60">
                    ⌘\
                  </kbd>
                </DropdownMenuItem>
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
            <DropdownMenuItem
              onClick={() => signOut({ redirectUrl: "/" })}
            >
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </div>

        {/* Lower section — tinted workspace area */}
        <div className="bg-muted/40 border-t p-1">
          <div className="px-2 pt-1.5 pb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Switch Workspaces
            </span>
            {pendingCount > 0 && (
              <span
                className="text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 leading-none cursor-pointer"
                onClick={() => router.push("/workspace-select")}
              >
                {pendingCount} pending
              </span>
            )}
          </div>
          <DropdownMenuGroup>
            {workspaces.map((ws) => {
              const name = stripWorkspaceSuffix(ws.name);
              const isCurrent = ws.id === workspaceId;
              return (
                <DropdownMenuItem
                  key={ws.id}
                  onClick={() => {
                    if (!isCurrent) switchWorkspace.mutate(ws.id);
                  }}
                  className={cn(
                    "cursor-pointer gap-3 px-3",
                    isCurrent && "bg-accent text-accent-foreground"
                  )}
                >
                  <Avatar className="h-7 w-7 rounded-lg">
                    {ws.icon && <AvatarImage src={ws.icon} alt={name} className="rounded-lg" />}
                    <AvatarFallback className="rounded-lg text-xs bg-muted text-muted-foreground">
                      {name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate text-sm">{name}</span>
                  {isCurrent && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuItem
              onClick={() => router.push("/workspace-create")}
              className="cursor-pointer gap-3 px-3"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground">
                <Plus className="h-4 w-4" />
              </span>
              <span className="text-sm">Create Workspace</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
