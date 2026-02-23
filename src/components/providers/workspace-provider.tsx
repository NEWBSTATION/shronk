"use client";

import { createContext, useContext, type ReactNode } from "react";

interface WorkspaceContextValue {
  workspaceId: string;
  workspaceName: string;
  workspaceIcon: string | null;
  isOwner: boolean;
  deletionScheduledAt: string | null;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  children,
  workspaceId,
  workspaceName,
  workspaceIcon,
  isOwner,
  deletionScheduledAt,
}: WorkspaceContextValue & { children: ReactNode }) {
  return (
    <WorkspaceContext.Provider value={{ workspaceId, workspaceName, workspaceIcon, isOwner, deletionScheduledAt }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return ctx;
}
