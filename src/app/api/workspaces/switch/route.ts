import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { members } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { WORKSPACE_COOKIE } from "@/lib/workspace";

const switchSchema = z.object({
  workspaceId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = switchSchema.parse(body);

    // Verify user is a member of the target workspace
    const member = await db.query.members.findFirst({
      where: and(
        eq(members.workspaceId, data.workspaceId),
        eq(members.userId, userId)
      ),
    });

    if (!member) {
      return NextResponse.json(
        { error: "Not a member of this workspace" },
        { status: 403 }
      );
    }

    // Set workspace cookie
    const cookieStore = await cookies();
    cookieStore.set(WORKSPACE_COOKIE, data.workspaceId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error switching workspace:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
