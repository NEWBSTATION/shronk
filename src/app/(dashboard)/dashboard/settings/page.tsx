"use client";

import { useUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileTab } from "@/components/settings/profile-tab";
import { PreferencesTab } from "@/components/settings/preferences-tab";
import { AppearanceTab } from "@/components/settings/appearance-tab";

export default function SettingsPage() {
  const { isLoaded, user } = useUser();

  if (!isLoaded) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex flex-col gap-6">
          <div className="h-10 w-64 animate-pulse rounded-lg bg-muted" />
          <div className="h-64 animate-pulse rounded-lg bg-muted" />
          <div className="h-48 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    );
  }

  if (!user) {
    redirect("/sign-in");
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Tabs defaultValue="profile" className="gap-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
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
      </Tabs>
    </div>
  );
}
