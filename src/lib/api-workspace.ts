import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { members, workspaces } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { WORKSPACE_COOKIE } from "./workspace";
import type { Member, Workspace } from "@/db/schema";

interface WorkspaceContext {
  userId: string;
  workspaceId: string;
  member: Member;
  workspace: Workspace;
}

export async function requireWorkspaceMember(): Promise<WorkspaceContext> {
  const { userId } = await auth();
  if (!userId) {
    throw new AuthError("Unauthorized", 401);
  }

  const cookieStore = await cookies();
  const workspaceId = cookieStore.get(WORKSPACE_COOKIE)?.value;
  if (!workspaceId) {
    throw new AuthError("No workspace selected", 400);
  }

  const member = await db.query.members.findFirst({
    where: and(
      eq(members.workspaceId, workspaceId),
      eq(members.userId, userId)
    ),
  });

  if (!member) {
    throw new AuthError("Not a member of this workspace", 403);
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
  });

  if (!workspace) {
    throw new AuthError("Workspace not found", 404);
  }

  return { userId, workspaceId, member, workspace };
}

export async function requireWorkspaceAdmin(): Promise<WorkspaceContext> {
  const ctx = await requireWorkspaceMember();
  if (ctx.member.role !== "admin") {
    throw new AuthError("Admin access required", 403);
  }
  return ctx;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "AuthError";
  }
}
