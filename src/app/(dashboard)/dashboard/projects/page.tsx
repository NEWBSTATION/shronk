import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ProjectsView } from "./projects-view";

export default async function ProjectsPage() {
  const { userId } = await auth();

  const userProjects = userId
    ? await db
        .select()
        .from(projects)
        .where(eq(projects.userId, userId))
        .orderBy(projects.createdAt)
    : [];

  return <ProjectsView initialProjects={userProjects} />;
}
