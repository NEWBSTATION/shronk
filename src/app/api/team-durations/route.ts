import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import {
  teamMilestoneDurations,
  milestones,
  projects,
  teams,
} from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { addDays } from "date-fns";
import { unifiedReflow } from "@/lib/unified-reflow";

function toLocalMidnight(date: Date | string): Date {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

const upsertSchema = z.object({
  milestoneId: z.string().uuid(),
  teamId: z.string().uuid(),
  duration: z.number().int().min(1),
});

const deleteSchema = z.object({
  milestoneId: z.string().uuid(),
  teamId: z.string().uuid(),
});

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const projectMilestones = await db
      .select({ id: milestones.id })
      .from(milestones)
      .where(eq(milestones.projectId, projectId));

    const milestoneIds = projectMilestones.map((m) => m.id);

    const durations =
      milestoneIds.length > 0
        ? await db
            .select()
            .from(teamMilestoneDurations)
            .where(
              inArray(teamMilestoneDurations.milestoneId, milestoneIds)
            )
        : [];

    return NextResponse.json({ teamDurations: durations });
  } catch (error) {
    console.error("Error fetching team durations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = upsertSchema.parse(body);

    // Verify milestone exists and user owns it
    const milestone = await db.query.milestones.findFirst({
      where: eq(milestones.id, data.milestoneId),
      with: { project: true },
    });

    if (!milestone) {
      return NextResponse.json(
        { error: "Milestone not found" },
        { status: 404 }
      );
    }

    if (milestone.project.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Verify team exists
    const team = await db.query.teams.findFirst({
      where: eq(teams.id, data.teamId),
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Upsert the team duration (start/end will be derived by unified reflow)
    const startDate = toLocalMidnight(milestone.startDate);
    const endDate = addDays(startDate, data.duration - 1);

    const existing = await db.query.teamMilestoneDurations.findFirst({
      where: and(
        eq(teamMilestoneDurations.milestoneId, data.milestoneId),
        eq(teamMilestoneDurations.teamId, data.teamId)
      ),
    });

    let teamDuration;
    if (existing) {
      [teamDuration] = await db
        .update(teamMilestoneDurations)
        .set({ duration: data.duration, startDate, endDate })
        .where(eq(teamMilestoneDurations.id, existing.id))
        .returning();
    } else {
      [teamDuration] = await db
        .insert(teamMilestoneDurations)
        .values({
          milestoneId: data.milestoneId,
          teamId: data.teamId,
          duration: data.duration,
          startDate,
          endDate,
        })
        .returning();
    }

    // Run unified reflow (expands parent if needed + cascades + derives dates)
    const { milestoneUpdates, durationExpansions, teamDateUpdates } =
      await unifiedReflow(milestone.projectId);

    // Re-fetch the updated team duration (unified reflow may have updated dates)
    const updated = await db.query.teamMilestoneDurations.findFirst({
      where: eq(teamMilestoneDurations.id, teamDuration.id),
    });

    return NextResponse.json({
      teamDuration: updated,
      cascadedUpdates: milestoneUpdates.map((u) => ({
        id: u.id,
        startDate: u.startDate.toISOString(),
        endDate: u.endDate.toISOString(),
        duration: u.duration,
      })),
      durationExpansions: durationExpansions.map((e) => ({
        id: e.id,
        oldDuration: e.oldDuration,
        newDuration: e.newDuration,
      })),
      teamCascadedUpdates: teamDateUpdates.map((td) => ({
        teamId: td.teamId,
        id: td.milestoneId,
        startDate: td.startDate.toISOString(),
        endDate: td.endDate.toISOString(),
        duration: td.duration,
      })),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error upserting team duration:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = deleteSchema.parse(body);

    // Verify milestone and ownership
    const milestone = await db.query.milestones.findFirst({
      where: eq(milestones.id, data.milestoneId),
      with: { project: true },
    });

    if (!milestone) {
      return NextResponse.json(
        { error: "Milestone not found" },
        { status: 404 }
      );
    }

    if (milestone.project.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Delete the team duration entry
    await db
      .delete(teamMilestoneDurations)
      .where(
        and(
          eq(teamMilestoneDurations.milestoneId, data.milestoneId),
          eq(teamMilestoneDurations.teamId, data.teamId)
        )
      );

    // Run unified reflow (parent keeps its duration per design — no auto-shrink)
    const { milestoneUpdates, teamDateUpdates } = await unifiedReflow(
      milestone.projectId
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
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error deleting team duration:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
