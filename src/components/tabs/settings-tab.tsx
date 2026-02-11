"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileTab } from "@/components/settings/profile-tab";
import { PreferencesTab } from "@/components/settings/preferences-tab";
import { AppearanceTab } from "@/components/settings/appearance-tab";
import { MembersTab } from "@/components/settings/members-tab";
import { TeamsTab } from "@/components/settings/teams-tab";
import { useMembers } from "@/hooks/use-members";

export function SettingsTab({ subTab = "profile" }: { subTab?: string }) {
  const [activeSubTab, setActiveSubTab] = useState(subTab);
  const { isLoaded, user } = useUser();
  const { data: membersData } = useMembers();
  const isAdmin = membersData?.currentUserRole === "admin";

  // Sync when parent changes the prop
  useEffect(() => {
    setActiveSubTab(subTab);
  }, [subTab]);

  if (!isLoaded) {
    return (
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto w-full max-w-xl lg:max-w-2xl xl:max-w-4xl">
          <div className="flex flex-col gap-6">
            {/* Tab pills */}
            <div className="flex items-center gap-1">
              <Skeleton className="h-8 w-20 rounded-md" />
              <Skeleton className="h-8 w-24 rounded-md" />
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
            {/* Profile section */}
            <div className="flex flex-col gap-4">
              <Skeleton className="h-5 w-32" />
              <div className="flex items-center gap-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
              </div>
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    redirect("/sign-in");
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8">
      <div className="mx-auto w-full max-w-xl lg:max-w-2xl xl:max-w-4xl">
        <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="gap-6">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="teams">Teams</TabsTrigger>
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
          <TabsContent value="teams">
            <TeamsTab />
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
