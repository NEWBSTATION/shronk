import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember, AuthError } from "@/lib/api-workspace";
import { db } from "@/db";
import { milestones, milestoneDependencies, projects } from "@/db/schema";
import { eq, and, or, inArray, asc } from "drizzle-orm";
import { z } from "zod";

const moveFeatureSchema = z.object({
  featureId: z.string().uuid(),
  targetProjectId: z.string().uuid(),
  insertAtIndex: z.number().int().min(0).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireWorkspaceMember();

    const body = await request.json();
    const data = moveFeatureSchema.parse(body);

    // Get the feature and verify ownership
    const feature = await db.query.milestones.findFirst({
      where: eq(milestones.id, data.featureId),
      with: { project: true },
    });

    if (!feature) {
      return NextResponse.json(
        { error: "Feature not found" },
        { status: 404 }
      );
    }

    if (feature.project.workspaceId !== ctx.workspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Verify target project ownership
    const targetProject = await db.query.projects.findFirst({
      where: and(
        eq(projects.id, data.targetProjectId),
        eq(projects.workspaceId, ctx.workspaceId)
      ),
    });

    if (!targetProject) {
      return NextResponse.json(
        { error: "Target milestone not found" },
        { status: 404 }
      );
    }

    // Same project — no-op
    if (feature.projectId === data.targetProjectId) {
      return NextResponse.json(
        { error: "Feature is already in this milestone" },
        { status: 400 }
      );
    }

    const oldProjectId = feature.projectId;

    // Get all dependencies involving this feature
    const featureDeps = await db
      .select()
      .from(milestoneDependencies)
      .where(
        or(
          eq(milestoneDependencies.predecessorId, data.featureId),
          eq(milestoneDependencies.successorId, data.featureId)
        )
      );

    const brokenDeps: Array<{ predecessorId: string; successorId: string }> =
      featureDeps.map((d) => ({
        predecessorId: d.predecessorId,
        successorId: d.successorId,
      }));

    // Bridge gaps: for each pair where feature is in the middle (pred→feature, feature→succ),
    // create pred→succ if it wouldn't create a cycle
    const predecessorIds = featureDeps
      .filter((d) => d.successorId === data.featureId)
      .map((d) => d.predecessorId);
    const successorIds = featureDeps
      .filter((d) => d.predecessorId === data.featureId)
      .map((d) => d.successorId);

    const bridgedDeps: Array<{ predecessorId: string; successorId: string }> =
      [];

    if (predecessorIds.length > 0 && successorIds.length > 0) {
      // Get all milestones in old project for cycle detection
      const projectMilestones = await db
        .select({ id: milestones.id })
        .from(milestones)
        .where(eq(milestones.projectId, oldProjectId));

      const milestoneIds = projectMilestones.map((m) => m.id);

      // Get all deps in old project (excluding the ones we're about to delete)
      const featureDepIds = new Set(featureDeps.map((d) => d.id));
      const allDeps = await db
        .select()
        .from(milestoneDependencies)
        .where(
          or(
            inArray(milestoneDependencies.predecessorId, milestoneIds),
            inArray(milestoneDependencies.successorId, milestoneIds)
          )
        );

      // Build adjacency without the feature's deps
      const successorMap = new Map<string, Set<string>>();
      for (const dep of allDeps) {
        if (featureDepIds.has(dep.id)) continue;
        const set = successorMap.get(dep.predecessorId) ?? new Set();
        set.add(dep.successorId);
        successorMap.set(dep.predecessorId, set);
      }

      // Check each potential bridge for cycles using BFS
      for (const predId of predecessorIds) {
        for (const succId of successorIds) {
          // Check if this edge already exists
          if (successorMap.get(predId)?.has(succId)) continue;

          // BFS: can succId reach predId via existing edges? If so, bridge would create cycle
          const queue = [succId];
          const visited = new Set<string>();
          let wouldCycle = false;

          while (queue.length > 0) {
            const current = queue.shift()!;
            if (current === predId) {
              wouldCycle = true;
              break;
            }
            if (visited.has(current)) continue;
            visited.add(current);
            const succs = successorMap.get(current);
            if (succs) {
              for (const s of succs) queue.push(s);
            }
          }

          if (!wouldCycle) {
            bridgedDeps.push({ predecessorId: predId, successorId: succId });
            // Add to adjacency so subsequent bridges account for it
            const set = successorMap.get(predId) ?? new Set();
            set.add(succId);
            successorMap.set(predId, set);
          }
        }
      }
    }

    // Delete all deps involving the feature
    if (featureDeps.length > 0) {
      await db
        .delete(milestoneDependencies)
        .where(
          inArray(
            milestoneDependencies.id,
            featureDeps.map((d) => d.id)
          )
        );
    }

    // Insert bridge dependencies
    if (bridgedDeps.length > 0) {
      await db.insert(milestoneDependencies).values(bridgedDeps);
    }

    // Move the feature to the new project
    await db
      .update(milestones)
      .set({
        projectId: data.targetProjectId,
        updatedAt: new Date(),
      })
      .where(eq(milestones.id, data.featureId));

    // Update sort order in target project to place feature at requested position
    if (data.insertAtIndex !== undefined) {
      // Get existing features in target project (excluding the just-moved one) sorted by current order
      const targetFeatures = await db
        .select({ id: milestones.id })
        .from(milestones)
        .where(
          and(
            eq(milestones.projectId, data.targetProjectId),
          )
        )
        .orderBy(asc(milestones.sortOrder));

      // Build the desired order: existing features with the moved one spliced in
      const otherIds = targetFeatures.filter((f) => f.id !== data.featureId).map((f) => f.id);
      const clampedIndex = Math.min(data.insertAtIndex, otherIds.length);
      otherIds.splice(clampedIndex, 0, data.featureId);

      // Batch update sort orders
      await Promise.all(
        otherIds.map((id, index) =>
          db
            .update(milestones)
            .set({ sortOrder: index })
            .where(eq(milestones.id, id))
        )
      );
    }

    // Get the updated feature
    const updatedFeature = await db.query.milestones.findFirst({
      where: eq(milestones.id, data.featureId),
    });

    return NextResponse.json({
      feature: updatedFeature,
      brokenDeps,
      bridgedDeps,
      oldProjectUpdates: [],
      newProjectUpdates: [],
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
    console.error("Error moving feature:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
