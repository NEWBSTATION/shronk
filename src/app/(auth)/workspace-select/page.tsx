"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useWorkspaces,
  useSwitchWorkspace,
  useAcceptWorkspaceInvite,
} from "@/hooks/use-workspaces";
import { Button } from "@/components/ui/button";
import { Building2, Plus, Users, Loader2, Mail } from "lucide-react";
import Image from "next/image";

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
    <div className="w-full max-w-md space-y-8">
      {/* Logo + heading */}
      <div className="flex flex-col items-center gap-3">
        <Image
          src="/orc-head.svg"
          alt="Shronk"
          width={32}
          height={32}
          className="dark:invert-0 invert"
        />
        <div className="text-center">
          <h1 className="text-xl font-semibold">Choose a workspace</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a workspace to continue
          </p>
        </div>
      </div>

      {/* Workspaces list */}
      {workspaces.length > 0 && (
        <div className="space-y-2">
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => switchWorkspace.mutate(ws.id)}
              disabled={switchWorkspace.isPending}
              className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors text-left disabled:opacity-50"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{ws.name}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {ws.role}
                </p>
              </div>
              {ws.isOwner && (
                <span className="text-xs text-muted-foreground shrink-0">
                  Owner
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" /> Pending Invites
          </h2>
          {pendingInvites.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center gap-3 p-3 rounded-lg border"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{inv.workspaceName}</p>
                <p className="text-xs text-muted-foreground capitalize">
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
          ))}
        </div>
      )}

      {/* Empty state */}
      {workspaces.length === 0 && pendingInvites.length === 0 && (
        <div className="text-center py-8">
          <Building2 className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm text-muted-foreground">
            No workspaces yet. Create one to get started.
          </p>
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
