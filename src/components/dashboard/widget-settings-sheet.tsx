"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { statusConfig, priorityConfig } from "@/components/shared/status-badge";
import type { WidgetConfig, WidgetSettings } from "@/types/dashboard";
import type { Team } from "@/db/schema";

interface WidgetSettingsSheetProps {
  widget: WidgetConfig | null;
  teams: Team[];
  onClose: () => void;
  onSave: (updated: WidgetConfig) => void;
}

export function WidgetSettingsSheet({
  widget,
  teams,
  onClose,
  onSave,
}: WidgetSettingsSheetProps) {
  const [settings, setSettings] = useState<WidgetSettings>({});

  useEffect(() => {
    if (widget) {
      setSettings({ ...widget.settings });
    }
  }, [widget]);

  if (!widget) return null;

  const handleSave = () => {
    onSave({ ...widget, settings });
  };

  const updateSetting = <K extends keyof WidgetSettings>(
    key: K,
    value: WidgetSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const filterStatus = settings.filters?.status ?? [];
  const filterPriority = settings.filters?.priority ?? [];
  const filterTeamId = settings.filters?.teamId ?? [];

  const toggleFilter = (
    dimension: "status" | "priority" | "teamId",
    value: string,
    checked: boolean
  ) => {
    const existing = settings.filters ?? {};
    const arr = [...(existing[dimension] ?? [])];
    if (checked) {
      arr.push(value);
    } else {
      const idx = arr.indexOf(value);
      if (idx >= 0) arr.splice(idx, 1);
    }
    updateSetting("filters", { ...existing, [dimension]: arr });
  };

  return (
    <Sheet open={!!widget} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader className="px-6 pt-6 pb-2">
          <SheetTitle>Widget Settings</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 px-6 pb-6">
          {/* Title */}
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={settings.title ?? ""}
              onChange={(e) => updateSetting("title", e.target.value)}
              placeholder="Widget title"
            />
          </div>

          {/* Stat settings */}
          {widget.type === "stat" && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label>Metric</Label>
                <Select
                  value={settings.metric ?? "total"}
                  onValueChange={(v) => updateSetting("metric", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="total">Total Features</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="up_next">Up Next</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="avg_progress">Avg Progress</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Chart settings */}
          {widget.type === "chart" && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label>Chart Type</Label>
                <Select
                  value={settings.chartType ?? "bar"}
                  onValueChange={(v) =>
                    updateSetting("chartType", v as WidgetSettings["chartType"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bar">Bar</SelectItem>
                    <SelectItem value="pie">Pie</SelectItem>
                    <SelectItem value="donut">Donut</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data Dimension</Label>
                <Select
                  value={settings.dataDimension ?? "status"}
                  onValueChange={(v) =>
                    updateSetting(
                      "dataDimension",
                      v as WidgetSettings["dataDimension"]
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="status">Status Distribution</SelectItem>
                    <SelectItem value="priority">Priority Distribution</SelectItem>
                    <SelectItem value="team">Team Distribution</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="show-legend"
                  checked={settings.showLegend !== false}
                  onCheckedChange={(checked) =>
                    updateSetting("showLegend", !!checked)
                  }
                />
                <Label htmlFor="show-legend">Show Legend</Label>
              </div>
            </>
          )}

          {/* Activity settings */}
          {widget.type === "activity" && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label>Item Limit</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={settings.itemLimit ?? 10}
                  onChange={(e) =>
                    updateSetting("itemLimit", parseInt(e.target.value) || 10)
                  }
                />
              </div>
            </>
          )}

          {/* Per-widget filters (all types) */}
          <Separator />
          <div className="space-y-4">
            <Label className="text-sm font-medium">Per-Widget Filters</Label>
            <p className="text-xs text-muted-foreground">
              Override global filters for this widget
            </p>

            {/* Status filter */}
            <div className="space-y-2">
              <Label className="text-xs">Status</Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(statusConfig).map(([key, cfg]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Checkbox
                      id={`ws-status-${key}`}
                      checked={filterStatus.includes(key)}
                      onCheckedChange={(checked) =>
                        toggleFilter("status", key, !!checked)
                      }
                    />
                    <Label
                      htmlFor={`ws-status-${key}`}
                      className="text-xs font-normal cursor-pointer"
                    >
                      {cfg.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Priority filter */}
            <div className="space-y-2">
              <Label className="text-xs">Priority</Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(priorityConfig).map(([key, cfg]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Checkbox
                      id={`ws-priority-${key}`}
                      checked={filterPriority.includes(key)}
                      onCheckedChange={(checked) =>
                        toggleFilter("priority", key, !!checked)
                      }
                    />
                    <Label
                      htmlFor={`ws-priority-${key}`}
                      className="text-xs font-normal cursor-pointer"
                    >
                      {cfg.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Team filter */}
            {teams.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs">Team</Label>
                <div className="grid grid-cols-2 gap-2">
                  {teams.map((team) => (
                    <div key={team.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`ws-team-${team.id}`}
                        checked={filterTeamId.includes(team.id)}
                        onCheckedChange={(checked) =>
                          toggleFilter("teamId", team.id, !!checked)
                        }
                      />
                      <Label
                        htmlFor={`ws-team-${team.id}`}
                        className="text-xs font-normal cursor-pointer flex items-center gap-1.5"
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
            )}
          </div>
        </div>

        <SheetFooter className="px-6 pb-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Apply</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
