import { cookies } from "next/headers";

export const WORKSPACE_COOKIE = "shronk-workspace-id";

export async function getWorkspaceId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(WORKSPACE_COOKIE)?.value ?? null;
}
