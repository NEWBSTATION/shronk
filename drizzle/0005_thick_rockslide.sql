ALTER TABLE "teams" DROP CONSTRAINT "teams_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "teams" DROP COLUMN "project_id";