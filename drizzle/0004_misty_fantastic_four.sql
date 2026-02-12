ALTER TABLE "milestones" DROP CONSTRAINT "milestones_team_id_teams_id_fk";
--> statement-breakpoint
ALTER TABLE "milestones" DROP COLUMN "team_id";