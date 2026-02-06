import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { MilestonesView } from "./milestones-view";

export default async function MilestonesPage() {
  const { userId } = await auth();

  // Fetch user's projects
  const userProjects = userId
    ? await db
        .select()
        .from(projects)
        .where(eq(projects.userId, userId))
        .orderBy(projects.createdAt)
    : [];

  return (
    <Suspense>
      <MilestonesView projects={userProjects} />
    </Suspense>
  );
}
