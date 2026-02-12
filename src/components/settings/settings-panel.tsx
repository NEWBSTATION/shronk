"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { CircleUser, SlidersHorizontal, Users, ShieldCheck, X, Cog } from "lucide-react";
import { useMembers } from "@/hooks/use-members";
import { ProfileTab } from "@/components/settings/profile-tab";
import { PreferencesTab } from "@/components/settings/preferences-tab";
import { TeamsTab } from "@/components/settings/teams-tab";
import { MembersTab } from "@/components/settings/members-tab";
import { cn } from "@/lib/utils";

export type SettingsSection = "profile" | "preferences" | "teams" | "members";

const sections: {
  id: SettingsSection;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}[] = [
  { id: "profile", label: "Profile", icon: CircleUser },
  { id: "preferences", label: "Preferences", icon: SlidersHorizontal },
  { id: "teams", label: "Teams", icon: Users },
  { id: "members", label: "Members", icon: ShieldCheck, adminOnly: true },
];

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
}

export function SettingsDialog({
  open,
  onOpenChange,
  activeSection,
  onSectionChange,
}: SettingsDialogProps) {
  const { data: membersData } = useMembers();
  const isAdmin = membersData?.currentUserRole === "admin";
  const visibleSections = sections.filter((s) => !s.adminOnly || isAdmin);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed top-[50%] left-[50%] z-50 translate-x-[-50%] translate-y-[-50%] w-[calc(100%-3rem)] max-w-[1700px] h-[calc(100vh-3rem)] rounded-xl border bg-background shadow-xl overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-[0.98] data-[state=open]:zoom-in-[0.98] duration-200 outline-none"
        >
          <DialogPrimitive.Title className="sr-only">Settings</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Manage your profile, preferences, teams, and members.
          </DialogPrimitive.Description>

          <div className="flex flex-col h-full">
            {/* Header bar — title left, tab pills center, close right */}
            <div className="flex shrink-0 items-center px-5 py-4 border-b">
              {/* Left: title */}
              <div className="flex-1 flex items-center">
                <h2 className="text-sm font-semibold flex items-center gap-1.5">
                  <Cog className="h-4 w-4 text-muted-foreground" />
                  Settings
                </h2>
              </div>

              {/* Center: tab pills — always show icon + label */}
              <div className="inline-flex items-center gap-1 rounded-2xl bg-muted p-1">
                {visibleSections.map((section) => {
                  const Icon = section.icon;
                  const isActive = activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      onClick={() => onSectionChange(section.id)}
                      className={cn(
                        "flex items-center justify-center gap-1.5 h-8 rounded-xl px-3 transition-all",
                        isActive
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="text-xs font-medium">{section.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Right: close */}
              <div className="flex-1 flex justify-end">
                <DialogPrimitive.Close className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-input bg-muted text-muted-foreground shadow-xs hover:bg-accent hover:text-foreground transition-colors">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </DialogPrimitive.Close>
              </div>
            </div>

            {/* Scrollable content — centered, fade at top edge */}
            <div className="flex-1 overflow-y-auto [mask-image:linear-gradient(to_bottom,transparent,black_16px)]">
              <div className="mx-auto w-full max-w-xl lg:max-w-2xl px-6 py-8">
                {activeSection === "profile" && <ProfileTab />}
                {activeSection === "preferences" && <PreferencesTab />}
                {activeSection === "teams" && <TeamsTab />}
                {activeSection === "members" && isAdmin && <MembersTab />}
              </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
