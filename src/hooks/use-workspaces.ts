"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface WorkspaceInfo {
  id: string;
  name: string;
  ownerId: string;
  role: "admin" | "member";
  isOwner: boolean;
}

interface PendingInvite {
  id: string;
  token: string;
  role: "admin" | "member";
  workspaceName: string;
  workspaceId: string;
  expiresAt: string;
}

interface WorkspacesResponse {
  workspaces: WorkspaceInfo[];
  pendingInvites: PendingInvite[];
}

export function useWorkspaces() {
  return useQuery<WorkspacesResponse>({
    queryKey: ["workspaces"],
    queryFn: async () => {
      const res = await fetch("/api/workspaces");
      if (!res.ok) throw new Error("Failed to fetch workspaces");
      return res.json();
    },
  });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string }) => {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create workspace");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });
}

export function useSwitchWorkspace() {
  return useMutation({
    mutationFn: async (workspaceId: string) => {
      const res = await fetch("/api/workspaces/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to switch workspace");
      }
      return res.json();
    },
    onSuccess: () => {
      // Full page reload to invalidate all cached data
      window.location.href = "/dashboard?tab=features";
    },
  });
}

export function useAcceptWorkspaceInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (token: string) => {
      const res = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to accept invite");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });
}
