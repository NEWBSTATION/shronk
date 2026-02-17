"use client";

import { createContext, useContext, type ReactNode } from "react";

interface WorkspaceContextValue {
  workspaceId: string;
  workspaceName: string;
  isOwner: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  children,
  workspaceId,
  workspaceName,
  isOwner,
}: WorkspaceContextValue & { children: ReactNode }) {
  return (
    <WorkspaceContext.Provider value={{ workspaceId, workspaceName, isOwner }}>
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
