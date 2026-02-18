"use client";

import { useWorkspace } from "@/components/providers/workspace-provider";
import { useWorkspaces, useSwitchWorkspace } from "@/hooks/use-workspaces";
import { ChevronsUpDown, Plus, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";

function stripWorkspaceSuffix(name: string) {
  return name.replace(/\s+workspace$/i, "").trim();
}

export function WorkspaceSwitcher() {
  const { workspaceId, workspaceName } = useWorkspace();
  const { data } = useWorkspaces();
  const switchWorkspace = useSwitchWorkspace();
  const router = useRouter();

  const workspaces = data?.workspaces ?? [];
  const pendingCount = data?.pendingInvites?.length ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors outline-none">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-primary text-[10px] font-semibold leading-none">
          {stripWorkspaceSuffix(workspaceName).charAt(0).toUpperCase()}
        </span>
        <span className="max-w-[120px] truncate">
          {stripWorkspaceSuffix(workspaceName)}
        </span>
        <ChevronsUpDown className="h-3 w-3 opacity-50 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Workspaces
        </DropdownMenuLabel>
        {workspaces.map((ws) => (
          <DropdownMenuItem
            key={ws.id}
            onClick={() => {
              if (ws.id !== workspaceId) {
                switchWorkspace.mutate(ws.id);
              }
            }}
            className="flex items-center gap-2 cursor-pointer"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-primary text-[10px] font-semibold leading-none">
              {stripWorkspaceSuffix(ws.name).charAt(0).toUpperCase()}
            </span>
            <span className="flex-1 truncate">
              {stripWorkspaceSuffix(ws.name)}
            </span>
            {ws.id === workspaceId && (
              <Check className="h-3.5 w-3.5 shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        {pendingCount > 0 && (
          <>
            <DropdownMenuItem
              onClick={() => router.push("/workspace-select")}
              className="flex items-center gap-2 cursor-pointer"
            >
              <span className="flex-1">Pending invites</span>
              <span className="text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 leading-none">
                {pendingCount}
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem
          onClick={() => router.push("/workspace-create")}
          className="flex items-center gap-2 cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          Create workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
