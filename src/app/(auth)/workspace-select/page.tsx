"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useWorkspaces,
  useSwitchWorkspace,
  useAcceptWorkspaceInvite,
} from "@/hooks/use-workspaces";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowRight, Plus, Loader2, Mail } from "lucide-react";
import Image from "next/image";

function stripWorkspaceSuffix(name: string) {
  return name.replace(/\s+workspace$/i, "").trim();
}

export default function WorkspaceSelectPage() {
  const { data, isLoading } = useWorkspaces();
  const switchWorkspace = useSwitchWorkspace();
  const acceptInvite = useAcceptWorkspaceInvite();
  const router = useRouter();
  const [acceptingToken, setAcceptingToken] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="w-full max-w-[600px] space-y-10">
        <div className="flex flex-col items-center gap-5">
          <div className="h-11 w-11 rounded-xl bg-muted animate-pulse" />
          <div className="flex flex-col items-center gap-2.5">
            <div className="h-6 w-48 rounded-md bg-muted animate-pulse" />
            <div className="h-4 w-56 rounded-md bg-muted/60 animate-pulse" />
          </div>
        </div>
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-4 py-3.5 rounded-xl border"
            >
              <div className="h-11 w-11 rounded-lg bg-muted animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div
                  className="h-4 rounded-md bg-muted animate-pulse"
                  style={{ width: `${60 - i * 16}%` }}
                />
                <div className="h-3 w-16 rounded-md bg-muted/60 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const workspaces = data?.workspaces ?? [];
  const pendingInvites = data?.pendingInvites ?? [];
  const isEmpty = workspaces.length === 0 && pendingInvites.length === 0;

  // Empty state — clean onboarding prompt
  if (isEmpty) {
    return (
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-8">
          <Image
            src="/orc-head.svg"
            alt="Shronk"
            width={44}
            height={44}
            className="dark:invert-0 invert"
          />
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Get started
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Create a workspace for your team to<br />
              track milestones and ship together.
            </p>
          </div>
          <Button
            size="lg"
            className="group h-11 gap-2 px-6 text-[15px] font-semibold"
            onClick={() => router.push("/workspace-create")}
          >
            Create Workspace
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[600px] space-y-10">
      {/* Logo + heading */}
      <div className="flex flex-col items-center gap-5">
        <Image
          src="/orc-head.svg"
          alt="Shronk"
          width={44}
          height={44}
          className="dark:invert-0 invert"
        />
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Choose a workspace
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Select a workspace to continue
          </p>
        </div>
      </div>

      {/* Workspaces list */}
      {workspaces.length > 0 && (
        <div className="space-y-3">
          {workspaces.map((ws) => {
            const displayName = stripWorkspaceSuffix(ws.name);
            return (
              <button
                key={ws.id}
                onClick={() => switchWorkspace.mutate(ws.id)}
                disabled={switchWorkspace.isPending}
                className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border hover:bg-accent transition-colors text-left disabled:opacity-50"
              >
                <Avatar className="h-11 w-11 rounded-lg shrink-0">
                  {ws.icon && <AvatarImage src={ws.icon} alt={displayName} className="rounded-lg" />}
                  <AvatarFallback className="rounded-lg text-lg bg-muted text-muted-foreground">
                    {displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{displayName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {ws.memberCount} {ws.memberCount === 1 ? "member" : "members"}
                  </p>
                </div>
                {ws.isOwner && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    Owner
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-2 px-1">
            <Mail className="h-3.5 w-3.5" /> Pending Invites
          </h2>
          {pendingInvites.map((inv) => {
            const displayName = stripWorkspaceSuffix(inv.workspaceName);
            return (
              <div
                key={inv.id}
                className="flex items-center gap-4 px-4 py-3.5 rounded-xl border"
              >
                <Avatar className="h-11 w-11 rounded-lg shrink-0">
                  <AvatarFallback className="rounded-lg text-lg font-semibold bg-muted text-muted-foreground">
                    {displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{displayName}</p>
                  <p className="text-xs text-muted-foreground capitalize mt-0.5">
                    Invited as {inv.role}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setAcceptingToken(inv.token);
                    acceptInvite.mutate(inv.token, {
                      onSuccess: () => {
                        // After accepting, switch to that workspace
                        switchWorkspace.mutate(inv.workspaceId);
                      },
                      onSettled: () => setAcceptingToken(null),
                    });
                  }}
                  disabled={acceptingToken === inv.token}
                >
                  {acceptingToken === inv.token ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    "Accept"
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Create workspace button */}
      <Button
        variant="outline"
        className="w-full gap-2"
        onClick={() => router.push("/workspace-create")}
      >
        <Plus className="h-4 w-4" /> Create Workspace
      </Button>
    </div>
  );
}
