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

  return (
    <WorkspaceProvider
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      isOwner={workspace.ownerId === userId}
    >
      <DashboardContent />
    </WorkspaceProvider>
  );
}
