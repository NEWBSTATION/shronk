"use client";

import { useState } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { z } from "zod";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Lock, Loader2, Camera } from "lucide-react";
import { AvatarEditorDialog } from "@/components/settings/avatar-editor-dialog";

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(50),
  lastName: z.string().min(1, "Last name is required").max(50),
  displayName: z.string().max(50).optional(),
});

export function ProfileTab() {
  const { user } = useUser();
  const { openUserProfile } = useClerk();

  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [displayName, setDisplayName] = useState(
    (user?.unsafeMetadata?.displayName as string) || ""
  );
  const [saving, setSaving] = useState(false);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);

  if (!user) return null;

  const hasExternalAccount =
    user.externalAccounts && user.externalAccounts.length > 0;
  const externalProvider = hasExternalAccount
    ? user.externalAccounts[0]?.provider
    : null;

  const formatProviderName = (provider: string | null) => {
    if (!provider) return "";
    return provider.charAt(0).toUpperCase() + provider.slice(1);
  };

  const initials =
    user.firstName && user.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`
      : user.firstName?.[0] ||
        user.emailAddresses[0]?.emailAddress[0]?.toUpperCase() ||
        "U";

  const currentDisplayName = user.fullName || user.firstName || "User";

  const hasChanges =
    firstName !== (user.firstName || "") ||
    lastName !== (user.lastName || "") ||
    displayName !== ((user.unsafeMetadata?.displayName as string) || "");

  const handleSave = async () => {
    const result = profileSchema.safeParse({ firstName, lastName, displayName });
    if (!result.success) {
      const firstError = result.error.issues[0];
      toast.error(firstError?.message || "Validation failed");
      return;
    }

    setSaving(true);
    try {
      await user.update({
        firstName: result.data.firstName,
        lastName: result.data.lastName,
        unsafeMetadata: {
          ...user.unsafeMetadata,
          displayName: result.data.displayName || "",
        },
      });
      toast.success("Profile updated successfully");
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Profile Section */}
      <div>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Profile
        </h3>
        <div className="rounded-lg border">
          {/* Avatar header row */}
          <div className="flex items-center gap-4 px-4 py-4 border-b">
            <button
              type="button"
              onClick={() => setAvatarDialogOpen(true)}
              className="group relative shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Avatar className="h-12 w-12">
                {user.hasImage && <AvatarImage src={user.imageUrl} alt={currentDisplayName} />}
                <AvatarFallback className="text-sm">{initials}</AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                <Camera className="h-5 w-5 text-white" />
              </div>
            </button>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{currentDisplayName}</p>
              <p className="text-sm text-muted-foreground">
                {user.primaryEmailAddress?.emailAddress}
              </p>
            </div>
            {hasExternalAccount && externalProvider && (
              <Badge variant="secondary" className="text-xs shrink-0">
                <Lock className="mr-1 h-3 w-3" />
                {formatProviderName(externalProvider)}
              </Badge>
            )}
          </div>

          {/* First Name */}
          <div className="flex items-center justify-between gap-4 px-4 py-3 border-b">
            <label htmlFor="firstName" className="text-sm font-medium flex items-center gap-2 shrink-0">
              First Name
              {hasExternalAccount && (
                <Lock className="h-3 w-3 text-muted-foreground" />
              )}
            </label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={hasExternalAccount}
              className={`max-w-60 ${hasExternalAccount ? "bg-muted cursor-not-allowed" : ""}`}
            />
          </div>

          {/* Last Name */}
          <div className="flex items-center justify-between gap-4 px-4 py-3 border-b">
            <label htmlFor="lastName" className="text-sm font-medium flex items-center gap-2 shrink-0">
              Last Name
              {hasExternalAccount && (
                <Lock className="h-3 w-3 text-muted-foreground" />
              )}
            </label>
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={hasExternalAccount}
              className={`max-w-60 ${hasExternalAccount ? "bg-muted cursor-not-allowed" : ""}`}
            />
          </div>

          {/* Display Name */}
          <div className="flex items-center justify-between gap-4 px-4 py-3 border-b">
            <div className="shrink-0">
              <label htmlFor="displayName" className="text-sm font-medium">
                Display Name
              </label>
              <p className="text-xs text-muted-foreground">
                Shown in the sidebar
              </p>
            </div>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Optional"
              className="max-w-60"
            />
          </div>

          {/* Email */}
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="shrink-0">
              <label htmlFor="email" className="text-sm font-medium flex items-center gap-2">
                Email
                <Lock className="h-3 w-3 text-muted-foreground" />
              </label>
              <p className="text-xs text-muted-foreground">
                Managed by your account provider
              </p>
            </div>
            <Input
              id="email"
              type="email"
              value={user.primaryEmailAddress?.emailAddress || ""}
              disabled
              className="max-w-60 bg-muted cursor-not-allowed"
            />
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="mt-3 w-full"
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </div>

      {/* Account Section */}
      <div>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Account
        </h3>
        <div className="rounded-lg border">
          {/* Username */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="text-sm font-medium">Username</span>
            <span className="text-sm text-muted-foreground">
              {user.username || "Not set"}
            </span>
          </div>

          {/* Account Created */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="text-sm font-medium">Account Created</span>
            <span className="text-sm text-muted-foreground">
              {user.createdAt
                ? new Date(user.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : "Unknown"}
            </span>
          </div>

          {/* Last Sign In */}
          <div className={`flex items-center justify-between px-4 py-3${hasExternalAccount ? " border-b" : ""}`}>
            <span className="text-sm font-medium">Last Sign In</span>
            <span className="text-sm text-muted-foreground">
              {user.lastSignInAt
                ? new Date(user.lastSignInAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Unknown"}
            </span>
          </div>

          {/* Connected Accounts */}
          {hasExternalAccount && (
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm font-medium">Connected Accounts</span>
              <div className="flex items-center gap-2">
                {user.externalAccounts.map((account) => (
                  <Badge key={account.id} variant="outline" className="text-xs capitalize">
                    {account.provider}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <Button
          variant="outline"
          className="mt-3 w-full"
          onClick={() => openUserProfile()}
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Manage Account in Clerk
        </Button>
      </div>

      <AvatarEditorDialog
        open={avatarDialogOpen}
        onOpenChange={setAvatarDialogOpen}
      />
    </div>
  );
}
