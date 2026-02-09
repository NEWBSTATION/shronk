"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { statusConfig, priorityConfig } from "@/components/shared/status-badge";
import { Filter, ChevronDown, X } from "lucide-react";
import type { GlobalFilters } from "@/types/dashboard";
import type { Team } from "@/db/schema";

interface GlobalFilterBarProps {
  filters: GlobalFilters;
  teams: Team[];
  isEditMode: boolean;
  onChange: (filters: GlobalFilters) => void;
}

export function GlobalFilterBar({
  filters,
  teams,
  isEditMode,
  onChange,
}: GlobalFilterBarProps) {
  if (!isEditMode) {
    // Read-only display of active filters
    const activeCount =
      filters.status.length + filters.priority.length + filters.teamId.length;
    if (activeCount === 0) return null;

    return (
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Filtered by:</span>
        {filters.status.map((s) => (
          <Badge key={s} variant="secondary" className="text-xs">
            {statusConfig[s as keyof typeof statusConfig]?.label ?? s}
          </Badge>
        ))}
        {filters.priority.map((p) => (
          <Badge key={p} variant="secondary" className="text-xs">
            {priorityConfig[p as keyof typeof priorityConfig]?.label ?? p}
          </Badge>
        ))}
        {filters.teamId.map((t) => {
          const team = teams.find((tm) => tm.id === t);
          return (
            <Badge key={t} variant="secondary" className="text-xs">
              {team?.name ?? "Unassigned"}
            </Badge>
          );
        })}
      </div>
    );
  }

  const activeCount =
    filters.status.length + filters.priority.length + filters.teamId.length;

  const toggleStatus = (key: string, checked: boolean) => {
    const arr = checked
      ? [...filters.status, key]
      : filters.status.filter((s) => s !== key);
    onChange({ ...filters, status: arr });
  };

  const togglePriority = (key: string, checked: boolean) => {
    const arr = checked
      ? [...filters.priority, key]
      : filters.priority.filter((p) => p !== key);
    onChange({ ...filters, priority: arr });
  };

  const toggleTeam = (key: string, checked: boolean) => {
    const arr = checked
      ? [...filters.teamId, key]
      : filters.teamId.filter((t) => t !== key);
    onChange({ ...filters, teamId: arr });
  };

  const clearAll = () => {
    onChange({ status: [], priority: [], teamId: [] });
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Global Filters
            {activeCount > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5">
                {activeCount}
              </Badge>
            )}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <div className="p-4 space-y-4">
            {/* Status */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Status</Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(statusConfig).map(([key, config]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Checkbox
                      id={`gf-status-${key}`}
                      checked={filters.status.includes(key)}
                      onCheckedChange={(checked) =>
                        toggleStatus(key, !!checked)
                      }
                    />
                    <Label
                      htmlFor={`gf-status-${key}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {config.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Priority */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Priority</Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(priorityConfig).map(([key, config]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Checkbox
                      id={`gf-priority-${key}`}
                      checked={filters.priority.includes(key)}
                      onCheckedChange={(checked) =>
                        togglePriority(key, !!checked)
                      }
                    />
                    <Label
                      htmlFor={`gf-priority-${key}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {config.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {teams.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Team</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {teams.map((team) => (
                      <div
                        key={team.id}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={`gf-team-${team.id}`}
                          checked={filters.teamId.includes(team.id)}
                          onCheckedChange={(checked) =>
                            toggleTeam(team.id, !!checked)
                          }
                        />
                        <Label
                          htmlFor={`gf-team-${team.id}`}
                          className="text-sm font-normal cursor-pointer flex items-center gap-1.5"
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: team.color }}
                          />
                          {team.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {activeCount > 0 && (
            <div className="border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={clearAll}
              >
                Clear all filters
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Active filter badges */}
      {filters.status.map((s) => (
        <Badge
          key={s}
          variant="secondary"
          className="text-xs gap-1 cursor-pointer"
          onClick={() => toggleStatus(s, false)}
        >
          {statusConfig[s as keyof typeof statusConfig]?.label ?? s}
          <X className="h-3 w-3" />
        </Badge>
      ))}
      {filters.priority.map((p) => (
        <Badge
          key={p}
          variant="secondary"
          className="text-xs gap-1 cursor-pointer"
          onClick={() => togglePriority(p, false)}
        >
          {priorityConfig[p as keyof typeof priorityConfig]?.label ?? p}
          <X className="h-3 w-3" />
        </Badge>
      ))}
      {filters.teamId.map((t) => {
        const team = teams.find((tm) => tm.id === t);
        return (
          <Badge
            key={t}
            variant="secondary"
            className="text-xs gap-1 cursor-pointer"
            onClick={() => toggleTeam(t, false)}
          >
            {team?.name ?? "Unassigned"}
            <X className="h-3 w-3" />
          </Badge>
        );
      })}

      {activeCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={clearAll}
        >
          Clear all
        </Button>
      )}
    </div>
  );
}
