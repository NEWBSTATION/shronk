ALTER TYPE "public"."milestone_priority" ADD VALUE 'none' BEFORE 'low';--> statement-breakpoint
ALTER TABLE "milestones" ALTER COLUMN "priority" SET DEFAULT 'none';