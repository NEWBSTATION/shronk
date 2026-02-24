"use client";

import * as React from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import type { SettingsSection } from "@/components/settings/settings-panel";
import {
  LogOut,
  Cog,
  Check,
  ShieldCheck,
  SlidersHorizontal,
  Plus,
  CheckCircle,
  XCircle,
  Mail,
  Palette,
  Sun,
  Moon,
  Monitor,
  Dices,
} from "lucide-react";
import { useMembers } from "@/hooks/use-members";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { useWorkspaces, useSwitchWorkspace, useAcceptWorkspaceInvite, useDeclineWorkspaceInvite } from "@/hooks/use-workspaces";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useThemeStore } from "@/store/theme-store";
import { themePresets } from "@/config/theme-presets";
import type { ThemeMode } from "@/types/theme";

function stripWorkspaceSuffix(name: string) {
  return name.replace(/\s+workspace$/i, "").trim();
}

interface HeaderUserMenuProps {
  onOpenSettings?: (section: SettingsSection) => void;
}

const modeOptions: { value: ThemeMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function HeaderUserMenu({ onOpenSettings }: HeaderUserMenuProps) {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const { data: membersData } = useMembers();
  const isAdmin = membersData?.currentUserRole === "admin";
  const { workspaceId } = useWorkspace();
  const { data: workspacesData } = useWorkspaces();
  const switchWorkspace = useSwitchWorkspace();
  const acceptInvite = useAcceptWorkspaceInvite();
  const declineInvite = useDeclineWorkspaceInvite();
  const router = useRouter();
  const workspaces = workspacesData?.workspaces ?? [];
  const pendingInvites = workspacesData?.pendingInvites ?? [];
  const { currentPresetKey, mode, setPreset, setMode, getResolvedMode, randomPreset } = useThemeStore();
  const pendingCount = pendingInvites.length;
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
    customDisplayName || user.fullName || user.firstName || "User";
  const email = user.primaryEmailAddress?.emailAddress || "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="inline-flex items-center rounded-full bg-card border border-border/50 p-1 relative">
          <button className="flex items-center justify-center h-8 w-8 rounded-full hover:glass-highlight hover:shadow-[0_1px_2px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.7)] dark:hover:shadow-[0_1px_2px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)] transition-all">
            <Avatar className="h-7 w-7 !rounded-full">
              {user.hasImage && <AvatarImage src={user.imageUrl} alt={displayName} />}
              <AvatarFallback className="!rounded-full text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>
          {pendingCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary border-2 border-card animate-pulse" />
          )}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 rounded-lg p-0 overflow-hidden" align="end" sideOffset={8}>
        {/* Upper section */}
        <div className="p-1">
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

          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => onOpenSettings?.("profile")}>
              <Cog />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onOpenSettings?.("preferences")}>
              <SlidersHorizontal />
              Preferences
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="hidden md:flex">
                <Palette />
                Theme
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-64 p-0" sideOffset={8}>
                {/* Mode row */}
                <div className="p-2 border-b border-foreground/10">
                  <div className="flex gap-1 rounded-lg bg-muted p-1">
                    {modeOptions.map((option) => {
                      const Icon = option.icon;
                      const isActive = mode === option.value;
                      return (
                        <button
                          key={option.value}
                          onClick={() => setMode(option.value)}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-1.5 h-7 rounded-md text-xs font-medium transition-colors",
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
                {/* Theme list */}
                <div className="max-h-[280px] overflow-y-auto p-1">
                  <button
                    onClick={() => randomPreset()}
                    className="flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <Dices className="h-3.5 w-3.5" />
                    <span className="flex-1 text-left">Random theme</span>
                    <kbd className="text-[10px] rounded bg-muted px-1.5 py-0.5 font-medium text-muted-foreground/60">
                      {typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent) ? "⌘\\" : "Ctrl+\\"}
                    </kbd>
                  </button>
                  {Object.entries(themePresets).map(([key, preset]) => {
                    const isActive = currentPresetKey === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setPreset(key)}
                        className={cn(
                          "flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-sm transition-colors",
                          isActive
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        <div
                          className="h-3.5 w-3.5 rounded-full border shrink-0"
                          style={{ backgroundColor: preset.styles[getResolvedMode()].primary }}
                        />
                        <span className="flex-1 text-left truncate">{preset.label}</span>
                        {isActive && <Check className="h-3.5 w-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            {isAdmin && (
              <DropdownMenuItem onClick={() => onOpenSettings?.("members")}>
                <ShieldCheck />
                Manage members
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => signOut({ redirectUrl: "/" })}
            >
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </div>

        {/* Lower section — workspace area */}
        <div className="bg-muted/40 border-t p-1">
          <div className="px-2 pt-1.5 pb-1">
            <span className="text-xs font-medium text-muted-foreground">
              Switch Workspace
            </span>
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

          {/* Pending invites */}
          {pendingCount > 0 && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 pt-1.5 pb-1 flex items-center gap-1.5">
                <Mail className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">
                  Pending Invites
                </span>
                <span className="text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 leading-none ml-auto">
                  {pendingCount}
                </span>
              </div>
              {pendingInvites.map((invite) => {
                const name = stripWorkspaceSuffix(invite.workspaceName);
                return (
                  <div
                    key={invite.id}
                    className="flex items-center gap-3 px-3 py-1.5 rounded-sm"
                  >
                    <Avatar className="h-7 w-7 rounded-lg">
                      <AvatarFallback className="rounded-lg text-xs bg-primary/10 text-primary">
                        {name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm truncate block">{name}</span>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          acceptInvite.mutate(invite.token, {
                            onSuccess: (data) => {
                              if (data.workspaceId) {
                                switchWorkspace.mutate(data.workspaceId);
                              }
                            },
                          });
                        }}
                        disabled={acceptInvite.isPending}
                        className="h-6 w-6 flex items-center justify-center rounded-md text-emerald-600 hover:bg-emerald-500/10 transition-colors"
                        title="Accept invite"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          declineInvite.mutate(invite.token);
                        }}
                        disabled={declineInvite.isPending}
                        className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Decline invite"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
