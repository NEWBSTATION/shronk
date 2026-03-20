import { tool, jsonSchema } from "ai";
import { z } from "zod";
import { db } from "@/db";
import {
  projects,
  milestones,
  milestoneDependencies,
  teams,
  teamMilestoneDurations,
} from "@/db/schema";
import { eq, and, inArray, or, ilike, sql } from "drizzle-orm";
import { differenceInDays, addDays } from "date-fns";
import { capitalizeWords } from "@/lib/capitalize";

function toMidnight(dateStr: string): Date {
  const d = new Date(dateStr);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function getAITools(workspaceId: string, userId: string) {
  return {
    list_milestones: tool({
      description:
        "List all milestones (project containers) in the workspace. Returns id, name, description, color, icon, startDate, endDate.",
      inputSchema: z.object({}),
      execute: async () => {
        const result = await db
          .select()
          .from(projects)
          .where(eq(projects.workspaceId, workspaceId))
          .orderBy(projects.createdAt);
        return {
          milestones: result.map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            color: p.color,
            icon: p.icon,
            startDate: p.startDate?.toISOString() ?? null,
            endDate: p.endDate?.toISOString() ?? null,
          })),
        };
      },
    }),

    list_features: tool({
      description:
        "List features (work items) in a milestone. Can filter by status, priority, or search text. Returns id, title, status, priority, startDate, endDate, duration, progress.",
      inputSchema: z.object({
        milestoneId: z.string().uuid().describe("The milestone (project) ID to list features from"),
        status: z.array(z.enum(["not_started", "in_progress", "on_hold", "completed", "cancelled"])).optional().describe("Filter by status values"),
        priority: z.array(z.enum(["none", "low", "medium", "high", "critical"])).optional().describe("Filter by priority values"),
        search: z.string().optional().describe("Search text to filter by title or description"),
      }),
      execute: async ({ milestoneId, status, priority, search }) => {
        // Verify workspace owns the project
        const project = await db.query.projects.findFirst({
          where: and(eq(projects.id, milestoneId), eq(projects.workspaceId, workspaceId)),
        });
        if (!project) return { error: "Milestone not found" };

        const conditions = [eq(milestones.projectId, milestoneId)];
        if (status?.length) {
          conditions.push(inArray(milestones.status, status));
        }
        if (priority?.length) {
          conditions.push(inArray(milestones.priority, priority));
        }
        if (search) {
          conditions.push(
            or(
              ilike(milestones.title, `%${search}%`),
              ilike(milestones.description, `%${search}%`)
            )!
          );
        }

        const result = await db
          .select()
          .from(milestones)
          .where(and(...conditions))
          .orderBy(milestones.sortOrder);

        return {
          features: result.map((m) => ({
            id: m.id,
            title: m.title,
            status: m.status,
            priority: m.priority,
            startDate: m.startDate.toISOString(),
            endDate: m.endDate.toISOString(),
            duration: m.duration,
            progress: m.progress,
            description: m.description,
          })),
        };
      },
    }),

    create_milestone: tool({
      description:
        "Create a new milestone (project container). Returns the created milestone.",
      inputSchema: z.object({
        name: z.string().min(1).max(255).describe("Milestone name"),
        description: z.string().optional().describe("Optional description"),
        color: z.string().max(20).optional().describe("Color name (e.g. blue, red, green)"),
        icon: z.string().max(50).optional().describe("Icon name (e.g. rocket, target, flag)"),
        startDate: z.string().optional().describe("ISO date string for start date"),
        endDate: z.string().optional().describe("ISO date string for end date"),
      }),
      execute: async ({ name, description, color, icon, startDate, endDate }) => {
        const [project] = await db
          .insert(projects)
          .values({
            workspaceId,
            userId,
            name: capitalizeWords(name),
            description,
            ...(color && { color }),
            ...(icon && { icon }),
            startDate: startDate ? new Date(startDate) : null,
            endDate: endDate ? new Date(endDate) : null,
          })
          .returning();

        return {
          milestone: {
            id: project.id,
            name: project.name,
            description: project.description,
            color: project.color,
            icon: project.icon,
          },
        };
      },
    }),

    create_feature: tool({
      description:
        "Create a new feature (work item) in a milestone. Returns the created feature.",
      inputSchema: z.object({
        milestoneId: z.string().uuid().describe("The milestone (project) ID"),
        title: z.string().min(1).max(255).describe("Feature title"),
        description: z.string().optional().describe("Optional description"),
        startDate: z.string().describe("ISO date string for start date"),
        duration: z.number().int().min(1).describe("Duration in days"),
        status: z.enum(["not_started", "in_progress", "on_hold", "completed", "cancelled"]).optional().describe("Status (default: not_started)"),
        priority: z.enum(["none", "low", "medium", "high", "critical"]).optional().describe("Priority (default: none)"),
      }),
      execute: async ({ milestoneId, title, description, startDate, duration, status, priority }) => {
        // Verify workspace owns the project
        const project = await db.query.projects.findFirst({
          where: and(eq(projects.id, milestoneId), eq(projects.workspaceId, workspaceId)),
        });
        if (!project) return { error: "Milestone not found" };

        const start = toMidnight(startDate);
        const end = duration === 0 ? start : addDays(start, duration - 1);

        // Get max sortOrder
        const maxSort = await db
          .select({ max: sql<number>`COALESCE(MAX(${milestones.sortOrder}), 0)` })
          .from(milestones)
          .where(eq(milestones.projectId, milestoneId));

        const [feature] = await db
          .insert(milestones)
          .values({
            projectId: milestoneId,
            title: capitalizeWords(title),
            description,
            startDate: start,
            endDate: end,
            duration,
            status: status ?? "not_started",
            priority: priority ?? "none",
            sortOrder: (maxSort[0]?.max || 0) + 1,
          })
          .returning();

        return {
          feature: {
            id: feature.id,
            title: feature.title,
            startDate: feature.startDate.toISOString(),
            endDate: feature.endDate.toISOString(),
            duration: feature.duration,
            status: feature.status,
            priority: feature.priority,
          },
        };
      },
    }),

    update_feature: tool({
      description:
        "Update an existing feature. Only provide the fields you want to change.",
      inputSchema: z.object({
        featureId: z.string().uuid().describe("The feature ID to update"),
        title: z.string().min(1).max(255).optional().describe("New title"),
        description: z.string().optional().nullable().describe("New description"),
        status: z.enum(["not_started", "in_progress", "on_hold", "completed", "cancelled"]).optional(),
        priority: z.enum(["none", "low", "medium", "high", "critical"]).optional(),
        progress: z.number().min(0).max(100).optional(),
        startDate: z.string().optional().describe("New start date (ISO)"),
        duration: z.number().int().min(1).optional().describe("New duration in days"),
      }),
      execute: async ({ featureId, title, description, status, priority, progress, startDate, duration }) => {
        const existing = await db.query.milestones.findFirst({
          where: eq(milestones.id, featureId),
          with: { project: true },
        });
        if (!existing) return { error: "Feature not found" };
        if (existing.project.workspaceId !== workspaceId) return { error: "Unauthorized" };

        const updateData: Record<string, unknown> = { updatedAt: new Date() };
        if (title !== undefined) updateData.title = capitalizeWords(title);
        if (description !== undefined) updateData.description = description;
        if (status !== undefined) {
          updateData.status = status;
          if (status === "completed") {
            updateData.completedAt = new Date();
            updateData.progress = 100;
          }
        }
        if (priority !== undefined) updateData.priority = priority;
        if (progress !== undefined) updateData.progress = progress;

        // Handle date/duration changes
        if (startDate !== undefined || duration !== undefined) {
          const start = startDate ? toMidnight(startDate) : existing.startDate;
          const dur = duration ?? existing.duration;
          updateData.startDate = start;
          updateData.duration = dur;
          updateData.endDate = dur === 0 ? start : addDays(start, dur - 1);
        }

        const [updated] = await db
          .update(milestones)
          .set(updateData)
          .where(eq(milestones.id, featureId))
          .returning();

        return {
          feature: {
            id: updated.id,
            title: updated.title,
            status: updated.status,
            priority: updated.priority,
            startDate: updated.startDate.toISOString(),
            endDate: updated.endDate.toISOString(),
            duration: updated.duration,
            progress: updated.progress,
          },
        };
      },
    }),

    bulk_update_features: tool({
      description:
        "Update multiple features at once. Apply the same changes to all specified feature IDs.",
      inputSchema: z.object({
        featureIds: z.array(z.string().uuid()).describe("Array of feature IDs to update"),
        status: z.enum(["not_started", "in_progress", "on_hold", "completed", "cancelled"]).optional(),
        priority: z.enum(["none", "low", "medium", "high", "critical"]).optional(),
        progress: z.number().min(0).max(100).optional(),
      }),
      execute: async ({ featureIds, status, priority, progress }) => {
        const updateData: Record<string, unknown> = { updatedAt: new Date() };
        if (status !== undefined) {
          updateData.status = status;
          if (status === "completed") {
            updateData.completedAt = new Date();
            updateData.progress = 100;
          }
        }
        if (priority !== undefined) updateData.priority = priority;
        if (progress !== undefined) updateData.progress = progress;

        // Verify all features belong to workspace
        const features = await db
          .select({ id: milestones.id, projectId: milestones.projectId })
          .from(milestones)
          .where(inArray(milestones.id, featureIds));

        const projectIds = [...new Set(features.map((f) => f.projectId))];
        const projectList = await db
          .select({ id: projects.id, workspaceId: projects.workspaceId })
          .from(projects)
          .where(inArray(projects.id, projectIds));

        const unauthorized = projectList.some((p) => p.workspaceId !== workspaceId);
        if (unauthorized) return { error: "Unauthorized" };

        await db
          .update(milestones)
          .set(updateData)
          .where(inArray(milestones.id, featureIds));

        return { updated: featureIds.length };
      },
    }),

    delete_feature: tool({
      description: "Delete a feature by ID.",
      inputSchema: z.object({
        featureId: z.string().uuid().describe("The feature ID to delete"),
      }),
      execute: async ({ featureId }) => {
        const existing = await db.query.milestones.findFirst({
          where: eq(milestones.id, featureId),
          with: { project: true },
        });
        if (!existing) return { error: "Feature not found" };
        if (existing.project.workspaceId !== workspaceId) return { error: "Unauthorized" };

        await db.delete(milestones).where(eq(milestones.id, featureId));
        return { deleted: true, title: existing.title };
      },
    }),

    create_dependency: tool({
      description:
        "Create a dependency between two features. The predecessor must finish before the successor starts.",
      inputSchema: z.object({
        predecessorId: z.string().uuid().describe("Feature that must finish first"),
        successorId: z.string().uuid().describe("Feature that depends on the predecessor"),
        lag: z.number().int().min(0).optional().describe("Delay in days between predecessor end and successor start (default: 0)"),
      }),
      execute: async ({ predecessorId, successorId, lag }) => {
        const [predecessor, successor] = await Promise.all([
          db.query.milestones.findFirst({
            where: eq(milestones.id, predecessorId),
            with: { project: true },
          }),
          db.query.milestones.findFirst({
            where: eq(milestones.id, successorId),
            with: { project: true },
          }),
        ]);

        if (!predecessor || !successor) return { error: "One or both features not found" };
        if (predecessor.project.workspaceId !== workspaceId) return { error: "Unauthorized" };
        if (predecessor.projectId !== successor.projectId) return { error: "Features must be in the same milestone" };

        // Check for existing dependency
        const existing = await db.query.milestoneDependencies.findFirst({
          where: and(
            eq(milestoneDependencies.predecessorId, predecessorId),
            eq(milestoneDependencies.successorId, successorId)
          ),
        });
        if (existing) return { error: "Dependency already exists" };

        const [dep] = await db
          .insert(milestoneDependencies)
          .values({
            predecessorId,
            successorId,
            lag: lag ?? 0,
          })
          .returning();

        return {
          dependency: {
            id: dep.id,
            predecessorId: dep.predecessorId,
            successorId: dep.successorId,
            lag: dep.lag,
          },
        };
      },
    }),

    list_teams: tool({
      description: "List all teams in the workspace.",
      inputSchema: z.object({}),
      execute: async () => {
        const result = await db
          .select()
          .from(teams)
          .where(eq(teams.workspaceId, workspaceId))
          .orderBy(teams.sortOrder);
        return {
          teams: result.map((t) => ({
            id: t.id,
            name: t.name,
            color: t.color,
            autoAdd: t.autoAdd,
          })),
        };
      },
    }),

    summarize_milestone: tool({
      description:
        "Get a comprehensive summary of a milestone including feature counts by status, at-risk items, and upcoming deadlines.",
      inputSchema: z.object({
        milestoneId: z.string().uuid().describe("The milestone (project) ID to summarize"),
      }),
      execute: async ({ milestoneId }) => {
        const project = await db.query.projects.findFirst({
          where: and(eq(projects.id, milestoneId), eq(projects.workspaceId, workspaceId)),
        });
        if (!project) return { error: "Milestone not found" };

        const features = await db
          .select()
          .from(milestones)
          .where(eq(milestones.projectId, milestoneId));

        const deps = features.length > 0
          ? await db
              .select()
              .from(milestoneDependencies)
              .where(
                or(
                  inArray(milestoneDependencies.predecessorId, features.map((f) => f.id)),
                  inArray(milestoneDependencies.successorId, features.map((f) => f.id))
                )
              )
          : [];

        const teamDurations = features.length > 0
          ? await db
              .select()
              .from(teamMilestoneDurations)
              .where(inArray(teamMilestoneDurations.milestoneId, features.map((f) => f.id)))
          : [];

        const today = new Date();
        const statusCounts = {
          not_started: 0,
          in_progress: 0,
          on_hold: 0,
          completed: 0,
          cancelled: 0,
        };
        const priorityCounts = {
          none: 0,
          low: 0,
          medium: 0,
          high: 0,
          critical: 0,
        };
        const overdue: string[] = [];
        const highPriorityUnstarted: string[] = [];

        for (const f of features) {
          statusCounts[f.status]++;
          priorityCounts[f.priority]++;
          if (f.endDate < today && f.status !== "completed" && f.status !== "cancelled") {
            overdue.push(f.title);
          }
          if ((f.priority === "high" || f.priority === "critical") && f.status === "not_started") {
            highPriorityUnstarted.push(f.title);
          }
        }

        return {
          milestone: { id: project.id, name: project.name },
          totalFeatures: features.length,
          statusCounts,
          priorityCounts,
          totalDependencies: deps.length,
          teamsInvolved: new Set(teamDurations.map((td) => td.teamId)).size,
          overdue,
          highPriorityUnstarted,
          completionRate: features.length > 0
            ? Math.round((statusCounts.completed / features.length) * 100)
            : 0,
        };
      },
    }),
  };
}
