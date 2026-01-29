import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ProjectsView } from "./projects-view";

export default async function ProjectsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const userProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(projects.createdAt);

  return <ProjectsView initialProjects={userProjects} />;
}
