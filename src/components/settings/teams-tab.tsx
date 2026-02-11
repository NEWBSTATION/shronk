"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, X, Loader2, Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  useProjects,
  useTeams,
  useCreateTeam,
  useUpdateTeam,
  useDeleteTeam,
} from "@/hooks/use-milestones";
import { MILESTONE_COLORS } from "@/lib/milestone-theme";
import { cn } from "@/lib/utils";

const COLOR_ENTRIES = Object.entries(MILESTONE_COLORS);

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="h-7 w-7 rounded-full border border-border shrink-0 transition-shadow hover:ring-2 hover:ring-ring/30"
          style={{ backgroundColor: value }}
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start" sideOffset={8}>
        <div className="grid grid-cols-6 gap-1.5">
          {COLOR_ENTRIES.map(([name, hex]) => (
            <button
              key={name}
              className={cn(
                "h-7 w-7 rounded-full transition-all",
                value === hex
                  ? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                  : "hover:scale-110"
              )}
              style={{ backgroundColor: hex }}
              title={name}
              onClick={() => {
                onChange(hex);
                setOpen(false);
              }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function TeamsTab() {
  const { data: projectsData, isLoading: loadingProjects } = useProjects();
  const projects = projectsData?.projects ?? [];

  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  // Auto-select first project
  if (!selectedProjectId && projects.length > 0) {
    setSelectedProjectId(projects[0].id);
  }

  const { data: teamsData, isLoading: loadingTeams } = useTeams(
    selectedProjectId || ""
  );
  const teams = teamsData?.teams ?? [];

  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();
  const deleteTeam = useDeleteTeam();

  // New team form
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(MILESTONE_COLORS.blue);

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const handleCreate = () => {
    if (!newName.trim() || !selectedProjectId) return;
    createTeam.mutate(
      { projectId: selectedProjectId, name: newName.trim(), color: newColor },
      {
        onSuccess: () => {
          toast.success("Team created");
          setNewName("");
          // Rotate to next color
          const idx = COLOR_ENTRIES.findIndex(([, hex]) => hex === newColor);
          const next = COLOR_ENTRIES[(idx + 1) % COLOR_ENTRIES.length];
          setNewColor(next[1]);
        },
        onError: (err) => toast.error(err.message),
      }
    );
  };

  const startEdit = (team: { id: string; name: string; color: string }) => {
    setEditingId(team.id);
    setEditName(team.name);
    setEditColor(team.color);
  };

  const saveEdit = () => {
    if (!editingId || !editName.trim()) return;
    updateTeam.mutate(
      { id: editingId, name: editName.trim(), color: editColor },
      {
        onSuccess: () => {
          toast.success("Team updated");
          setEditingId(null);
        },
        onError: (err) => toast.error(err.message),
      }
    );
  };

  const handleDelete = () => {
    if (!deleteTarget || !selectedProjectId) return;
    deleteTeam.mutate(
      { id: deleteTarget.id, projectId: selectedProjectId },
      {
        onSuccess: () => {
          toast.success("Team deleted");
          setDeleteTarget(null);
        },
        onError: (err) => {
          toast.error(err.message);
          setDeleteTarget(null);
        },
      }
    );
  };

  if (loadingProjects) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Create a milestone first to manage teams.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* Project selector */}
      {projects.length > 1 && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Milestone
          </label>
          <Select
            value={selectedProjectId}
            onValueChange={setSelectedProjectId}
          >
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue placeholder="Select milestone" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {projects.length === 1 && (
        <p className="text-xs text-muted-foreground">
          Managing teams for <span className="font-medium text-foreground">{projects[0].name}</span>
        </p>
      )}

      {/* Team list */}
      <div>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Teams ({teams.length})
        </h3>

        {loadingTeams ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="rounded-lg border">
            {teams.map((team, i) => {
              const isEditing = editingId === team.id;

              return (
                <div
                  key={team.id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3",
                    i < teams.length - 1 && "border-b"
                  )}
                >
                  {isEditing ? (
                    <>
                      <ColorPicker value={editColor} onChange={setEditColor} />
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-8 flex-1"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit();
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        autoFocus
                      />
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={saveEdit}
                        disabled={updateTeam.isPending}
                      >
                        <Check className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <div
                        className="h-5 w-5 rounded-full shrink-0"
                        style={{ backgroundColor: team.color }}
                      />
                      <span className="text-sm font-medium flex-1 truncate">
                        {team.name}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() =>
                          startEdit({
                            id: team.id,
                            name: team.name,
                            color: team.color,
                          })
                        }
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() =>
                          setDeleteTarget({ id: team.id, name: team.name })
                        }
                      >
                        <X className="size-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              );
            })}

            {/* Add new team row */}
            <div className="flex items-center gap-3 px-4 py-3">
              <ColorPicker value={newColor} onChange={setNewColor} />
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New team name"
                className="h-8 flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                }}
              />
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={!newName.trim() || createTeam.isPending}
              >
                {createTeam.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Plus className="size-3.5" />
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete team</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;?
              This will also remove all team track durations for this team.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTeam.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
