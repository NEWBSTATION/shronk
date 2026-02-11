CREATE TABLE "team_milestone_durations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"milestone_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"duration" integer DEFAULT 1 NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_milestone_durations" ADD CONSTRAINT "team_milestone_durations_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_milestone_durations" ADD CONSTRAINT "team_milestone_durations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "team_milestone_durations_milestone_team_idx" ON "team_milestone_durations" USING btree ("milestone_id","team_id");