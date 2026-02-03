"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Lock } from "lucide-react";

export default function ProfilePage() {
  const { user, isLoaded } = useUser();
  const { openUserProfile } = useClerk();

  if (!isLoaded) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="h-6 w-32 animate-pulse rounded bg-muted" />
              <div className="h-4 w-48 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="h-32 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!user) {
    redirect("/sign-in");
  }

  const initials = user.firstName && user.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user.firstName?.[0] || user.emailAddresses[0]?.emailAddress[0]?.toUpperCase() || "U";

  const displayName = user.fullName || user.firstName || "User";

  // Determine if fields are managed externally (e.g., OAuth)
  const hasExternalAccount = user.externalAccounts && user.externalAccounts.length > 0;
  const externalProvider = hasExternalAccount
    ? user.externalAccounts[0]?.provider
    : null;

  // Format provider name for display
  const formatProviderName = (provider: string | null) => {
    if (!provider) return "";
    return provider.charAt(0).toUpperCase() + provider.slice(1);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        {/* Profile Overview Card */}
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>
              Your personal account information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar Section */}
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={user.imageUrl} alt={displayName} />
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <h3 className="font-medium">{displayName}</h3>
                <p className="text-sm text-muted-foreground">
                  {user.primaryEmailAddress?.emailAddress}
                </p>
                {hasExternalAccount && externalProvider && (
                  <Badge variant="secondary" className="text-xs">
                    <Lock className="mr-1 h-3 w-3" />
                    Managed by {formatProviderName(externalProvider)}
                  </Badge>
                )}
              </div>
            </div>

            {/* Profile Fields */}
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="firstName" className="flex items-center gap-2">
                  First Name
                  {hasExternalAccount && (
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  )}
                </Label>
                <Input
                  id="firstName"
                  value={user.firstName || ""}
                  readOnly={hasExternalAccount}
                  disabled={hasExternalAccount}
                  className={hasExternalAccount ? "bg-muted cursor-not-allowed" : ""}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="lastName" className="flex items-center gap-2">
                  Last Name
                  {hasExternalAccount && (
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  )}
                </Label>
                <Input
                  id="lastName"
                  value={user.lastName || ""}
                  readOnly={hasExternalAccount}
                  disabled={hasExternalAccount}
                  className={hasExternalAccount ? "bg-muted cursor-not-allowed" : ""}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  Email
                  <Lock className="h-3 w-3 text-muted-foreground" />
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={user.primaryEmailAddress?.emailAddress || ""}
                  readOnly
                  disabled
                  className="bg-muted cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground">
                  Email changes are managed through your account provider
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Details Card */}
        <Card>
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
            <CardDescription>
              Additional account information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="username" className="flex items-center gap-2">
                Username
              </Label>
              <Input
                id="username"
                value={user.username || "Not set"}
                readOnly
                disabled
                className="bg-muted cursor-not-allowed"
              />
            </div>

            <div className="grid gap-2">
              <Label>Account Created</Label>
              <Input
                value={user.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                }) : "Unknown"}
                readOnly
                disabled
                className="bg-muted cursor-not-allowed"
              />
            </div>

            <div className="grid gap-2">
              <Label>Last Sign In</Label>
              <Input
                value={user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }) : "Unknown"}
                readOnly
                disabled
                className="bg-muted cursor-not-allowed"
              />
            </div>

            {/* Connected Accounts */}
            {hasExternalAccount && (
              <div className="space-y-2">
                <Label>Connected Accounts</Label>
                <div className="space-y-2">
                  {user.externalAccounts.map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between rounded-md border p-3"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium capitalize">
                          {account.provider}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          Connected
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Manage Account Link */}
            <div className="pt-4">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => openUserProfile()}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Manage Account in Clerk
              </Button>
              <p className="mt-2 text-xs text-muted-foreground text-center">
                For security settings, password changes, and advanced account management
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
