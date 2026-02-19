import {
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  pgEnum,
  integer,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const memberRoleEnum = pgEnum("member_role", ["admin", "member"]);

export const inviteStatusEnum = pgEnum("invite_status", [
  "pending",
  "accepted",
  "expired",
  "revoked",
  "declined",
]);

export const milestoneStatusEnum = pgEnum("milestone_status", [
  "not_started",
  "in_progress",
  "on_hold",
  "completed",
  "cancelled",
]);

export const milestonePriorityEnum = pgEnum("milestone_priority", [
  "none",
  "low",
  "medium",
  "high",
  "critical",
]);

// Workspaces table
export const workspaces = pgTable("workspaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  icon: text("icon"),
  ownerId: varchar("owner_id", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Members table
export const members = pgTable(
  "members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    role: memberRoleEnum("role").default("member").notNull(),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("members_workspace_user_idx").on(
      table.workspaceId,
      table.userId
    ),
  ]
);

// Invites table
export const invites = pgTable("invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" })
    .notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  role: memberRoleEnum("role").default("admin").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  status: inviteStatusEnum("status").default("pending").notNull(),
  invitedBy: varchar("invited_by", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

// Invite links table (shareable workspace invite URLs)
export const inviteLinks = pgTable("invite_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" })
    .notNull(),
  role: memberRoleEnum("role").default("member").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

// Projects table
export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" })
    .notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 20 }).default("blue").notNull(),
  icon: varchar("icon", { length: 50 }).default("rocket").notNull(),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Teams table (workspace-level — not scoped to a project)
export const teams = pgTable("teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  color: varchar("color", { length: 7 }).default("#6366f1").notNull(),
  autoAdd: boolean("auto_add").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Milestones table
export const milestones = pgTable("milestones", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  status: milestoneStatusEnum("status").default("not_started").notNull(),
  priority: milestonePriorityEnum("priority").default("none").notNull(),
  progress: integer("progress").default(0).notNull(),
  duration: integer("duration").default(1).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Dashboard layouts table
export const dashboardLayouts = pgTable("dashboard_layouts", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  widgets: text("widgets").notNull(), // JSON string of WidgetConfig[]
  globalFilters: text("global_filters"), // JSON string of GlobalFilters
  updatedBy: varchar("updated_by", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Milestone dependencies table
export const milestoneDependencies = pgTable("milestone_dependencies", {
  id: uuid("id").defaultRandom().primaryKey(),
  predecessorId: uuid("predecessor_id")
    .references(() => milestones.id, { onDelete: "cascade" })
    .notNull(),
  successorId: uuid("successor_id")
    .references(() => milestones.id, { onDelete: "cascade" })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Team milestone durations table (per-team duration overrides)
export const teamMilestoneDurations = pgTable(
  "team_milestone_durations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    milestoneId: uuid("milestone_id")
      .references(() => milestones.id, { onDelete: "cascade" })
      .notNull(),
    teamId: uuid("team_id")
      .references(() => teams.id, { onDelete: "cascade" })
      .notNull(),
    duration: integer("duration").default(1).notNull(),
    startDate: timestamp("start_date").notNull(),
    endDate: timestamp("end_date").notNull(),
  },
  (table) => [
    uniqueIndex("team_milestone_durations_milestone_team_idx").on(
      table.milestoneId,
      table.teamId
    ),
  ]
);

// Relations
export const workspacesRelations = relations(workspaces, ({ many }) => ({
  members: many(members),
  invites: many(invites),
  inviteLinks: many(inviteLinks),
  projects: many(projects),
  teams: many(teams),
}));

export const membersRelations = relations(members, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [members.workspaceId],
    references: [workspaces.id],
  }),
}));

export const invitesRelations = relations(invites, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [invites.workspaceId],
    references: [workspaces.id],
  }),
}));

export const inviteLinksRelations = relations(inviteLinks, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [inviteLinks.workspaceId],
    references: [workspaces.id],
  }),
}));

export const projectsRelations = relations(projects, ({ many, one }) => ({
  workspace: one(workspaces, {
    fields: [projects.workspaceId],
    references: [workspaces.id],
  }),
  milestones: many(milestones),
  dashboardLayout: one(dashboardLayouts, {
    fields: [projects.id],
    references: [dashboardLayouts.projectId],
  }),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [teams.workspaceId],
    references: [workspaces.id],
  }),
  teamMilestoneDurations: many(teamMilestoneDurations),
}));

export const milestonesRelations = relations(milestones, ({ one, many }) => ({
  project: one(projects, {
    fields: [milestones.projectId],
    references: [projects.id],
  }),
  predecessors: many(milestoneDependencies, { relationName: "successor" }),
  successors: many(milestoneDependencies, { relationName: "predecessor" }),
  teamMilestoneDurations: many(teamMilestoneDurations),
}));

export const dashboardLayoutsRelations = relations(dashboardLayouts, ({ one }) => ({
  project: one(projects, {
    fields: [dashboardLayouts.projectId],
    references: [projects.id],
  }),
}));

export const milestoneDependenciesRelations = relations(
  milestoneDependencies,
  ({ one }) => ({
    predecessor: one(milestones, {
      fields: [milestoneDependencies.predecessorId],
      references: [milestones.id],
      relationName: "predecessor",
    }),
    successor: one(milestones, {
      fields: [milestoneDependencies.successorId],
      references: [milestones.id],
      relationName: "successor",
    }),
  })
);

export const teamMilestoneDurationsRelations = relations(
  teamMilestoneDurations,
  ({ one }) => ({
    milestone: one(milestones, {
      fields: [teamMilestoneDurations.milestoneId],
      references: [milestones.id],
    }),
    team: one(teams, {
      fields: [teamMilestoneDurations.teamId],
      references: [teams.id],
    }),
  })
);

// Types
export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type Milestone = typeof milestones.$inferSelect;
export type NewMilestone = typeof milestones.$inferInsert;
export type MilestoneDependency = typeof milestoneDependencies.$inferSelect;
export type NewMilestoneDependency = typeof milestoneDependencies.$inferInsert;
export type MilestoneStatus =
  | "not_started"
  | "in_progress"
  | "on_hold"
  | "completed"
  | "cancelled";
export type MilestonePriority = "none" | "low" | "medium" | "high" | "critical";
export type Member = typeof members.$inferSelect;
export type NewMember = typeof members.$inferInsert;
export type Invite = typeof invites.$inferSelect;
export type NewInvite = typeof invites.$inferInsert;
export type InviteLink = typeof inviteLinks.$inferSelect;
export type NewInviteLink = typeof inviteLinks.$inferInsert;
export type DashboardLayout = typeof dashboardLayouts.$inferSelect;
export type NewDashboardLayout = typeof dashboardLayouts.$inferInsert;
export type TeamMilestoneDuration = typeof teamMilestoneDurations.$inferSelect;
export type NewTeamMilestoneDuration = typeof teamMilestoneDurations.$inferInsert;
