import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { workspaces } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getWorkspaceId } from "@/lib/workspace";
import { WorkspaceProvider } from "@/components/providers/workspace-provider";
import { DashboardContent } from "./dashboard-content";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const workspaceId = await getWorkspaceId();
  if (!workspaceId) {
    redirect("/workspace-select");
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
  });

  if (!workspace) {
    // Invalid workspace cookie — clear it and redirect
    redirect("/workspace-select");
  }

  // If deletion grace period has expired, hard-delete and redirect
  if (workspace.deletionScheduledAt) {
    const deletionDate = new Date(workspace.deletionScheduledAt);
    deletionDate.setDate(deletionDate.getDate() + 30);
    if (new Date() >= deletionDate) {
      await db.delete(workspaces).where(eq(workspaces.id, workspace.id));
      redirect("/workspace-select");
    }
  }

  return (
    <WorkspaceProvider
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      workspaceIcon={workspace.icon}
      isOwner={workspace.ownerId === userId}
      deletionScheduledAt={workspace.deletionScheduledAt?.toISOString() ?? null}
    >
      <DashboardContent />
    </WorkspaceProvider>
  );
}
