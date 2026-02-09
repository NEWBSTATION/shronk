import {
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  pgEnum,
  integer,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const memberRoleEnum = pgEnum("member_role", ["admin", "member"]);

export const inviteStatusEnum = pgEnum("invite_status", [
  "pending",
  "accepted",
  "expired",
  "revoked",
]);

export const milestoneStatusEnum = pgEnum("milestone_status", [
  "not_started",
  "in_progress",
  "on_hold",
  "completed",
  "cancelled",
]);

export const milestonePriorityEnum = pgEnum("milestone_priority", [
  "low",
  "medium",
  "high",
  "critical",
]);

// Members table
export const members = pgTable("members", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull(),
  role: memberRoleEnum("role").default("member").notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

// Invites table
export const invites = pgTable("invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  role: memberRoleEnum("role").default("admin").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  status: inviteStatusEnum("status").default("pending").notNull(),
  invitedBy: varchar("invited_by", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

// Projects table
export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Teams table
export const teams = pgTable("teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  color: varchar("color", { length: 7 }).default("#6366f1").notNull(),
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
  priority: milestonePriorityEnum("priority").default("medium").notNull(),
  progress: integer("progress").default(0).notNull(),
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
  duration: integer("duration").default(1).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  completedAt: timestamp("completed_at"),
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

// Relations
export const projectsRelations = relations(projects, ({ many }) => ({
  milestones: many(milestones),
  teams: many(teams),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  project: one(projects, {
    fields: [teams.projectId],
    references: [projects.id],
  }),
  milestones: many(milestones),
}));

export const milestonesRelations = relations(milestones, ({ one, many }) => ({
  project: one(projects, {
    fields: [milestones.projectId],
    references: [projects.id],
  }),
  team: one(teams, {
    fields: [milestones.teamId],
    references: [teams.id],
  }),
  predecessors: many(milestoneDependencies, { relationName: "successor" }),
  successors: many(milestoneDependencies, { relationName: "predecessor" }),
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

// Types
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
export type MilestonePriority = "low" | "medium" | "high" | "critical";
export type Member = typeof members.$inferSelect;
export type NewMember = typeof members.$inferInsert;
export type Invite = typeof invites.$inferSelect;
export type NewInvite = typeof invites.$inferInsert;
