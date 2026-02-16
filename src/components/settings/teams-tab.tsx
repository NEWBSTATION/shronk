"use client";

import { useState, useMemo, useRef } from "react";
import { toast } from "sonner";
import { Plus, X, Loader2, Pencil, Check, ChevronRight, Trash2, Users, Zap, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
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
  useTeams,
  useCreateTeam,
  useUpdateTeam,
  useDeleteTeam,
} from "@/hooks/use-milestones";
import { Switch } from "@/components/ui/switch";
import { MILESTONE_COLORS, getColorStyles } from "@/lib/milestone-theme";
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
          onClick={(e) => e.stopPropagation()}
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

function TeamRow({
  team,
  isEditing,
  editName,
  editColor,
  onEditNameChange,
  onEditColorChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onToggleAutoAdd,
  isSaving,
}: {
  team: { id: string; name: string; color: string; autoAdd: boolean };
  isEditing: boolean;
  editName: string;
  editColor: string;
  onEditNameChange: (v: string) => void;
  onEditColorChange: (v: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onToggleAutoAdd: () => void;
  isSaving: boolean;
}) {
  if (isEditing) {
    return (
      <div className="flex items-center px-4 py-3.5 bg-background border-b last:border-b-0 gap-3">
        <ColorPicker value={editColor} onChange={onEditColorChange} />
        <Input
          value={editName}
          onChange={(e) => onEditNameChange(e.target.value)}
          className="h-8 flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter") onSaveEdit();
            if (e.key === "Escape") onCancelEdit();
          }}
          autoFocus
        />
        <button
          onClick={onSaveEdit}
          disabled={isSaving}
          className="shrink-0 h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onCancelEdit}
          className="shrink-0 h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={onStartEdit}
      className="flex items-center px-4 py-3.5 transition-colors cursor-pointer group bg-background hover:bg-accent/50 border-b last:border-b-0"
    >
      {/* Color dot */}
      <div
        className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center"
        style={{ backgroundColor: `${team.color}20` }}
      >
        <div
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: team.color }}
        />
      </div>

      {/* Name + right actions */}
      <div className="flex flex-1 ml-3 min-w-0 items-center gap-3">
        <span className="text-sm font-medium flex-1 truncate text-left">
          {team.name}
        </span>

        {/* Actions — appear on hover, to the left of the switch */}
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStartEdit();
            }}
            className="shrink-0 h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent/50 transition-all"
            title="Edit team"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="shrink-0 h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
            title="Delete team"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Auto-add toggle — always visible, right-aligned */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 shrink-0"
          title="Auto-add to new features"
        >
          <Zap className={cn("h-3 w-3 transition-colors", team.autoAdd ? "text-amber-500" : "text-muted-foreground/30")} />
          <Switch
            size="sm"
            checked={team.autoAdd}
            onCheckedChange={onToggleAutoAdd}
          />
        </div>
      </div>
    </div>
  );
}

const HEADER_STYLES = getColorStyles("slate");

export function TeamsTab() {
  const { data: teamsData, isLoading: loadingTeams } = useTeams();
  const teams = teamsData?.teams ?? [];

  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();
  const deleteTeam = useDeleteTeam();

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredTeams = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter((t) => t.name.toLowerCase().includes(q));
  }, [teams, searchQuery]);

  // New team form
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(MILESTONE_COLORS.blue);
  const [showAddForm, setShowAddForm] = useState(false);

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
    if (!newName.trim()) return;
    createTeam.mutate(
      { name: newName.trim(), color: newColor },
      {
        onSuccess: () => {
          toast.success("Team created");
          setNewName("");
          setShowAddForm(false);
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
    if (!deleteTarget) return;
    deleteTeam.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success("Team deleted");
        setDeleteTarget(null);
      },
      onError: (err) => {
        toast.error(err.message);
        setDeleteTarget(null);
      },
    });
  };

  if (loadingTeams) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b last:border-b-0">
              <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
              <div className="h-4 w-32 rounded bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (teams.length === 0 && !showAddForm) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="h-16 w-16 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">No teams yet</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm">
            Create teams to organize work across your milestones.
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(true)}
          className="w-full rounded-2xl border border-dashed border-border px-4 py-3 flex items-center gap-3 text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-accent/20 transition-colors"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Plus className="h-4 w-4" />
          </div>
          <span className="text-sm">New team</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search input */}
      {teams.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search teams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                searchInputRef.current?.focus();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {searchQuery && filteredTeams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            No teams matching &quot;{searchQuery.trim()}&quot;
          </p>
        </div>
      ) : (
      <>
      {/* Teams card */}
      <div className="rounded-2xl overflow-hidden border">
        {/* Header — mirrors milestone SectionHeader */}
        <div className="w-full text-left group relative overflow-hidden px-4 py-3 rounded-t-2xl border-b">
          {/* Gradient background layer */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(to right, transparent 30%, ${HEADER_STYLES.gradient} 100%)`,
            }}
          />
          <div className="relative flex items-center gap-3">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: HEADER_STYLES.iconBg, color: HEADER_STYLES.hex }}
            >
              <Users className="h-4 w-4" />
            </div>
            <div className="flex flex-1 items-center gap-2 min-w-0">
              <span className="text-sm font-medium truncate">Teams</span>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {filteredTeams.length}
              </span>
            </div>

            <button
              onClick={() => setShowAddForm(true)}
              className="shrink-0 h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-accent/50 transition-all"
              title="Add team"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Team rows */}
        {filteredTeams.map((team) => (
          <TeamRow
            key={team.id}
            team={team}
            isEditing={editingId === team.id}
            editName={editName}
            editColor={editColor}
            onEditNameChange={setEditName}
            onEditColorChange={setEditColor}
            onStartEdit={() => startEdit(team)}
            onSaveEdit={saveEdit}
            onCancelEdit={() => setEditingId(null)}
            onDelete={() => setDeleteTarget({ id: team.id, name: team.name })}
            onToggleAutoAdd={() => updateTeam.mutate({ id: team.id, autoAdd: !team.autoAdd })}
            isSaving={updateTeam.isPending}
          />
        ))}

        {/* Add team row — inline in the card */}
        {showAddForm ? (
          <div className="flex items-center gap-3 px-4 py-3.5 border-t bg-background">
            <ColorPicker value={newColor} onChange={setNewColor} />
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Team name"
              className="h-8 flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") {
                  setShowAddForm(false);
                  setNewName("");
                }
              }}
              autoFocus
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || createTeam.isPending}
              className="shrink-0 h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all disabled:opacity-50"
            >
              {createTeam.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                setNewName("");
              }}
              className="shrink-0 h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full px-4 py-3.5 flex items-center gap-3 text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors cursor-pointer border-t"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center">
              <Plus className="h-4 w-4" />
            </div>
            <span className="text-sm">Add a team</span>
          </button>
        )}
      </div>
      </>
      )}

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
