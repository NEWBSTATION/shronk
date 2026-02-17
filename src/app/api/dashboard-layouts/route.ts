import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember, requireWorkspaceAdmin, AuthError } from "@/lib/api-workspace";
import { db } from "@/db";
import { dashboardLayouts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { generateDefaultLayout } from "@/lib/dashboard-defaults";

const widgetConfigSchema = z.object({
  id: z.string(),
  type: z.enum(["stat", "chart", "progress", "activity"]),
  layout: z.object({
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
  }),
  settings: z.record(z.string(), z.unknown()),
});

const putSchema = z.object({
  projectId: z.string().uuid(),
  widgets: z.array(widgetConfigSchema),
  globalFilters: z
    .object({
      status: z.array(z.string()).default([]),
      priority: z.array(z.string()).default([]),
      teamId: z.array(z.string()).default([]),
      dateRange: z
        .object({
          from: z.string().optional(),
          to: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requireWorkspaceMember();

    const projectId = request.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    const layout = await db.query.dashboardLayouts.findFirst({
      where: eq(dashboardLayouts.projectId, projectId),
    });

    if (!layout) {
      return NextResponse.json({
        widgets: generateDefaultLayout(),
        globalFilters: { status: [], priority: [], teamId: [] },
        isDefault: true,
      });
    }

    return NextResponse.json({
      widgets: JSON.parse(layout.widgets),
      globalFilters: layout.globalFilters
        ? JSON.parse(layout.globalFilters)
        : { status: [], priority: [], teamId: [] },
      isDefault: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error fetching dashboard layout:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const ctx = await requireWorkspaceAdmin();

    const body = await request.json();
    const data = putSchema.parse(body);

    const widgetsJson = JSON.stringify(data.widgets);
    const globalFiltersJson = data.globalFilters
      ? JSON.stringify(data.globalFilters)
      : null;

    // Upsert: insert or update on conflict
    const [result] = await db
      .insert(dashboardLayouts)
      .values({
        projectId: data.projectId,
        widgets: widgetsJson,
        globalFilters: globalFiltersJson,
        updatedBy: ctx.userId,
      })
      .onConflictDoUpdate({
        target: dashboardLayouts.projectId,
        set: {
          widgets: widgetsJson,
          globalFilters: globalFiltersJson,
          updatedBy: ctx.userId,
          updatedAt: new Date(),
        },
      })
      .returning();

    return NextResponse.json({
      widgets: JSON.parse(result.widgets),
      globalFilters: result.globalFilters
        ? JSON.parse(result.globalFilters)
        : { status: [], priority: [], teamId: [] },
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
    console.error("Error saving dashboard layout:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
