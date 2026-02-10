"use client";

import { useUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileTab } from "@/components/settings/profile-tab";
import { PreferencesTab } from "@/components/settings/preferences-tab";
import { AppearanceTab } from "@/components/settings/appearance-tab";
import { MembersTab } from "@/components/settings/members-tab";
import { useMembers } from "@/hooks/use-members";

export function SettingsTab() {
  const { isLoaded, user } = useUser();
  const { data: membersData } = useMembers();
  const isAdmin = membersData?.currentUserRole === "admin";

  if (!isLoaded) {
    return (
      <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-4 md:py-6">
        <div className="mx-auto w-full max-w-xl lg:max-w-2xl xl:max-w-4xl">
          <div className="flex flex-col gap-6">
            <div className="h-10 w-64 animate-pulse rounded-lg bg-muted" />
            <div className="h-64 animate-pulse rounded-lg bg-muted" />
            <div className="h-48 animate-pulse rounded-lg bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    redirect("/sign-in");
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-4 md:py-6">
      <div className="mx-auto w-full max-w-xl lg:max-w-2xl xl:max-w-4xl">
        <Tabs defaultValue="profile" className="gap-6">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            {isAdmin && <TabsTrigger value="members">Members</TabsTrigger>}
          </TabsList>
          <TabsContent value="profile">
            <ProfileTab />
          </TabsContent>
          <TabsContent value="preferences">
            <PreferencesTab />
          </TabsContent>
          <TabsContent value="appearance">
            <AppearanceTab />
          </TabsContent>
          {isAdmin && (
            <TabsContent value="members">
              <MembersTab />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
