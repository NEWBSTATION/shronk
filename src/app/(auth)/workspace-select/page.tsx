"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useWorkspaces,
  useSwitchWorkspace,
  useAcceptWorkspaceInvite,
} from "@/hooks/use-workspaces";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, Mail } from "lucide-react";
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
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const workspaces = data?.workspaces ?? [];
  const pendingInvites = data?.pendingInvites ?? [];

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
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary text-lg font-semibold">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{displayName}</p>
                  <p className="text-xs text-muted-foreground capitalize mt-0.5">
                    {ws.role}
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
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground text-lg font-semibold">
                  {displayName.charAt(0).toUpperCase()}
                </div>
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

      {/* Empty state */}
      {workspaces.length === 0 && pendingInvites.length === 0 && (
        <button
          onClick={() => router.push("/workspace-create")}
          className="w-full rounded-xl border border-dashed border-muted-foreground/25 py-10 flex flex-col items-center gap-3 text-muted-foreground hover:border-muted-foreground/40 hover:bg-accent/50 transition-colors"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Plus className="h-5 w-5" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              No workspaces yet
            </p>
            <p className="text-xs mt-1">Create one to get started</p>
          </div>
        </button>
      )}

      {/* Create workspace button — only show when workspaces exist */}
      {(workspaces.length > 0 || pendingInvites.length > 0) && (
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => router.push("/workspace-create")}
        >
          <Plus className="h-4 w-4" /> Create Workspace
        </Button>
      )}
    </div>
  );
}
