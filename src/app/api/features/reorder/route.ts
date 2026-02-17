import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember, AuthError } from "@/lib/api-workspace";
import { db } from "@/db";
import { milestones, milestoneDependencies, projects } from "@/db/schema";
import { eq, and, or, inArray } from "drizzle-orm";
import { z } from "zod";
import { addDays } from "date-fns";
import { unifiedReflow } from "@/lib/unified-reflow";

const reorderSchema = z.object({
  projectId: z.string().uuid(),
  orderedFeatureIds: z.array(z.string().uuid()).min(1),
});

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireWorkspaceMember();

    const body = await request.json();
    const data = reorderSchema.parse(body);

    // Verify project ownership
    const project = await db.query.projects.findFirst({
      where: and(
        eq(projects.id, data.projectId),
        eq(projects.workspaceId, ctx.workspaceId)
      ),
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Get all features in this project
    const projectFeatures = await db
      .select()
      .from(milestones)
      .where(eq(milestones.projectId, data.projectId));

    const featureIds = new Set(projectFeatures.map((f) => f.id));

    // Validate all ordered IDs belong to this project
    for (const id of data.orderedFeatureIds) {
      if (!featureIds.has(id)) {
        return NextResponse.json(
          { error: `Feature ${id} not found in this project` },
          { status: 400 }
        );
      }
    }

    // Validate no duplicates
    if (new Set(data.orderedFeatureIds).size !== data.orderedFeatureIds.length) {
      return NextResponse.json(
        { error: "Duplicate feature IDs" },
        { status: 400 }
      );
    }

    // Validate all project features are included
    if (data.orderedFeatureIds.length !== projectFeatures.length) {
      return NextResponse.json(
        { error: "Must include all features in the project" },
        { status: 400 }
      );
    }

    // Get all dependencies involving these features
    const allDeps = await db
      .select()
      .from(milestoneDependencies)
      .where(
        or(
          inArray(milestoneDependencies.predecessorId, projectFeatures.map((f) => f.id)),
          inArray(milestoneDependencies.successorId, projectFeatures.map((f) => f.id))
        )
      );

    // Separate intra-project deps from external deps
    const intraDeps = allDeps.filter(
      (d) => featureIds.has(d.predecessorId) && featureIds.has(d.successorId)
    );
    const externalDeps = allDeps.filter(
      (d) => !featureIds.has(d.predecessorId) || !featureIds.has(d.successorId)
    );

    // Validate that intra-project deps form a linear chain (or no deps at all)
    // Each feature should have at most 1 intra predecessor and 1 intra successor
    const intraPredCount = new Map<string, number>();
    const intraSuccCount = new Map<string, number>();
    for (const d of intraDeps) {
      intraPredCount.set(d.successorId, (intraPredCount.get(d.successorId) ?? 0) + 1);
      intraSuccCount.set(d.predecessorId, (intraSuccCount.get(d.predecessorId) ?? 0) + 1);
    }

    for (const [id, count] of intraPredCount) {
      if (count > 1) {
        return NextResponse.json(
          { error: "Cannot reorder: feature chain has branches (multiple predecessors)" },
          { status: 400 }
        );
      }
    }
    for (const [id, count] of intraSuccCount) {
      if (count > 1) {
        return NextResponse.json(
          { error: "Cannot reorder: feature chain has branches (multiple successors)" },
          { status: 400 }
        );
      }
    }

    // Find the current root(s) — features with no intra predecessors
    const currentRoots = projectFeatures.filter(
      (f) => !intraDeps.some((d) => d.successorId === f.id)
    );

    // The new root's start date = earliest start date among current roots
    const rootStartDate = currentRoots.reduce((earliest, f) => {
      const fStart = new Date(f.startDate);
      return fStart < earliest ? fStart : earliest;
    }, new Date(currentRoots[0].startDate));

    // Update sortOrder to match the new order
    await Promise.all(
      data.orderedFeatureIds.map((id, index) =>
        db
          .update(milestones)
          .set({ sortOrder: index, updatedAt: new Date() })
          .where(eq(milestones.id, id))
      )
    );

    // Delete all intra-project dependencies
    if (intraDeps.length > 0) {
      await db
        .delete(milestoneDependencies)
        .where(
          inArray(
            milestoneDependencies.id,
            intraDeps.map((d) => d.id)
          )
        );
    }

    // Create new chain dependencies based on the ordered list
    const newDeps: Array<{ predecessorId: string; successorId: string }> = [];
    for (let i = 0; i < data.orderedFeatureIds.length - 1; i++) {
      newDeps.push({
        predecessorId: data.orderedFeatureIds[i],
        successorId: data.orderedFeatureIds[i + 1],
      });
    }

    if (newDeps.length > 0) {
      await db.insert(milestoneDependencies).values(newDeps);
    }

    // Update the new root feature's start date to the original root's start date
    const newRootId = data.orderedFeatureIds[0];
    const newRootFeature = projectFeatures.find((f) => f.id === newRootId)!;
    const newRootDuration = newRootFeature.duration;

    await db
      .update(milestones)
      .set({
        startDate: rootStartDate,
        endDate: addDays(rootStartDate, newRootDuration - 1),
        updatedAt: new Date(),
      })
      .where(eq(milestones.id, newRootId));

    // Run reflow to cascade all dates
    const { milestoneUpdates, teamDateUpdates } = await unifiedReflow(
      data.projectId,
      undefined,
      new Set([newRootId]) // skip the root we just updated
    );

    return NextResponse.json({
      success: true,
      cascadedUpdates: milestoneUpdates.map((u) => ({
        id: u.id,
        startDate: u.startDate.toISOString(),
        endDate: u.endDate.toISOString(),
        duration: u.duration,
      })),
      teamCascadedUpdates: teamDateUpdates.map((td) => ({
        teamId: td.teamId,
        id: td.milestoneId,
        startDate: td.startDate.toISOString(),
        endDate: td.endDate.toISOString(),
        duration: td.duration,
      })),
      // Return the new root's dates for cache update
      newRootUpdate: {
        id: newRootId,
        startDate: rootStartDate.toISOString(),
        endDate: addDays(rootStartDate, newRootDuration - 1).toISOString(),
        duration: newRootDuration,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error reordering features:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
