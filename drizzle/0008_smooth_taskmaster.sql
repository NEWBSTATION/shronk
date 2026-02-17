-- 1. Create workspaces table
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"owner_id" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
-- 2. Drop the old unique constraint on members.user_id
ALTER TABLE "members" DROP CONSTRAINT IF EXISTS "members_user_id_unique";

--> statement-breakpoint
-- 3. Add workspace_id columns as NULLABLE first
ALTER TABLE "invites" ADD COLUMN "workspace_id" uuid;
--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "workspace_id" uuid;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "workspace_id" uuid;
--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "workspace_id" uuid;

--> statement-breakpoint
-- 4. Create a default workspace from the first admin member (if any data exists)
DO $$
DECLARE
  ws_id uuid;
  admin_user_id varchar(255);
BEGIN
  -- Find the first admin member
  SELECT user_id INTO admin_user_id FROM members WHERE role = 'admin' ORDER BY joined_at ASC LIMIT 1;

  IF admin_user_id IS NOT NULL THEN
    -- Create a default workspace
    INSERT INTO workspaces (id, name, owner_id) VALUES (gen_random_uuid(), 'Default Workspace', admin_user_id) RETURNING id INTO ws_id;

    -- Backfill all existing rows
    UPDATE members SET workspace_id = ws_id WHERE workspace_id IS NULL;
    UPDATE invites SET workspace_id = ws_id WHERE workspace_id IS NULL;
    UPDATE projects SET workspace_id = ws_id WHERE workspace_id IS NULL;
    UPDATE teams SET workspace_id = ws_id WHERE workspace_id IS NULL;
  END IF;
END $$;

--> statement-breakpoint
-- 5. Set columns NOT NULL
ALTER TABLE "invites" ALTER COLUMN "workspace_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "members" ALTER COLUMN "workspace_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "workspace_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "teams" ALTER COLUMN "workspace_id" SET NOT NULL;

--> statement-breakpoint
-- 6. Add foreign keys
ALTER TABLE "invites" ADD CONSTRAINT "invites_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
-- 7. Add compound unique index on members
CREATE UNIQUE INDEX "members_workspace_user_idx" ON "members" USING btree ("workspace_id","user_id");
