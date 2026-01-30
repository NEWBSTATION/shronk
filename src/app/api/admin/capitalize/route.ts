import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { projects, milestones } from "@/db/schema";
import { eq } from "drizzle-orm";
import { capitalizeWords } from "@/lib/capitalize";

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all user's projects (milestones in UI)
    const userProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, userId));

    let projectsUpdated = 0;
    let featuresUpdated = 0;

    // Update project names
    for (const project of userProjects) {
      const capitalized = capitalizeWords(project.name);
      if (capitalized !== project.name) {
        await db
          .update(projects)
          .set({ name: capitalized, updatedAt: new Date() })
          .where(eq(projects.id, project.id));
        projectsUpdated++;
      }
    }

    // Get all features (milestones in DB) for user's projects
    const projectIds = userProjects.map(p => p.id);

    if (projectIds.length > 0) {
      for (const projectId of projectIds) {
        const features = await db
          .select()
          .from(milestones)
          .where(eq(milestones.projectId, projectId));

        for (const feature of features) {
          const capitalized = capitalizeWords(feature.title);
          if (capitalized !== feature.title) {
            await db
              .update(milestones)
              .set({ title: capitalized, updatedAt: new Date() })
              .where(eq(milestones.id, feature.id));
            featuresUpdated++;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      projectsUpdated,
      featuresUpdated,
    });
  } catch (error) {
    console.error("Error capitalizing names:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
