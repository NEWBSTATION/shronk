"use client";

import { useState } from "react";
import { useCreateWorkspace } from "@/hooks/use-workspaces";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function WorkspaceCreatePage() {
  const [name, setName] = useState("");
  const createWorkspace = useCreateWorkspace();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createWorkspace.mutate(
      { name: name.trim() },
      {
        onSuccess: () => {
          // Full reload to ensure fresh data with new workspace cookie
          window.location.href = "/dashboard?tab=features";
        },
      }
    );
  };

  return (
    <div className="w-full max-w-sm space-y-8">
      {/* Logo + heading */}
      <div className="flex flex-col items-center gap-3">
        <Image
          src="/orc-head.svg"
          alt="Shronk"
          width={32}
          height={32}
          className="dark:invert-0 invert"
        />
        <div className="text-center">
          <h1 className="text-xl font-semibold">Create a workspace</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A workspace is where your team collaborates
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Workspace name</Label>
          <Input
            id="name"
            placeholder="e.g. My Team"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={!name.trim() || createWorkspace.isPending}
        >
          {createWorkspace.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Create Workspace"
          )}
        </Button>
        {createWorkspace.isError && (
          <p className="text-sm text-destructive text-center">
            {createWorkspace.error.message}
          </p>
        )}
      </form>

      {/* Back link */}
      <div className="text-center">
        <Link
          href="/workspace-select"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="h-3 w-3" /> Back to workspaces
        </Link>
      </div>
    </div>
  );
}
