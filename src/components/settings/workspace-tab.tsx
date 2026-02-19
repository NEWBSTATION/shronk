"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { useUpdateWorkspace } from "@/hooks/use-workspaces";
import { useMembers } from "@/hooks/use-members";

function resizeImageToBase64(file: File, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      // Draw centered/cropped square
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export function WorkspaceTab() {
  const { workspaceId, workspaceName, workspaceIcon } = useWorkspace();
  const { data: membersData } = useMembers();
  const isAdmin = membersData?.currentUserRole === "admin";
  const updateWorkspace = useUpdateWorkspace();

  const [name, setName] = useState(workspaceName);
  const [icon, setIcon] = useState<string | null>(workspaceIcon);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasChanges = name !== workspaceName || icon !== workspaceIcon;
  const fallbackChar = (name || workspaceName).charAt(0).toUpperCase();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    try {
      const base64 = await resizeImageToBase64(file, 64);
      setIcon(base64);
    } catch {
      toast.error("Failed to process image");
    }

    // Reset input so the same file can be selected again
    e.target.value = "";
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Workspace name is required");
      return;
    }

    try {
      await updateWorkspace.mutateAsync({
        id: workspaceId,
        name: name.trim(),
        icon,
      });
      toast.success("Workspace updated");
      // Reload to update server-rendered context
      window.location.reload();
    } catch {
      toast.error("Failed to update workspace");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Workspace
        </h3>
        <div className="rounded-lg border">
          {/* Icon row */}
          <div className="flex items-center gap-4 px-4 py-4 border-b">
            <button
              type="button"
              onClick={() => isAdmin && fileInputRef.current?.click()}
              disabled={!isAdmin}
              className="group relative shrink-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed"
            >
              <Avatar className="h-12 w-12 rounded-lg">
                {icon && <AvatarImage src={icon} alt={name} className="rounded-lg" />}
                <AvatarFallback className="rounded-lg text-sm bg-muted text-muted-foreground">
                  {fallbackChar}
                </AvatarFallback>
              </Avatar>
              {isAdmin && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <Camera className="h-5 w-5 text-white" />
                </div>
              )}
            </button>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{name || workspaceName}</p>
              <p className="text-sm text-muted-foreground">
                {isAdmin ? "Click icon to upload" : "Workspace icon"}
              </p>
            </div>
            {isAdmin && icon && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIcon(null)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {/* Name row */}
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <label htmlFor="workspaceName" className="text-sm font-medium shrink-0">
              Name
            </label>
            <Input
              id="workspaceName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isAdmin}
              className={`max-w-60 ${!isAdmin ? "bg-muted cursor-not-allowed" : ""}`}
            />
          </div>
        </div>

        {isAdmin && (
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateWorkspace.isPending}
            className="mt-3 w-full"
          >
            {updateWorkspace.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        )}
      </div>
    </div>
  );
}
