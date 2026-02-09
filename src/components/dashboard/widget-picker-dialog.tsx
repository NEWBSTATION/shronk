"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WIDGET_PICKER_ITEMS, WIDGET_REGISTRY } from "./widget-registry";
import type { WidgetConfig } from "@/types/dashboard";
import type { WidgetPickerItem } from "@/types/dashboard";

interface WidgetPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (widget: WidgetConfig) => void;
  widgets: WidgetConfig[];
}

const CATEGORIES: { label: string; filter: (item: WidgetPickerItem) => boolean }[] = [
  { label: "Stats", filter: (i) => i.type === "stat" },
  { label: "Charts", filter: (i) => i.type === "chart" },
  { label: "Tracking", filter: (i) => i.type === "progress" || i.type === "activity" },
];

export function WidgetPickerDialog({
  open,
  onOpenChange,
  onAdd,
  widgets,
}: WidgetPickerDialogProps) {
  const handleSelect = (item: WidgetPickerItem) => {
    const def = WIDGET_REGISTRY[item.type];
    const bottomY = widgets.length > 0
      ? Math.max(...widgets.map((w) => w.layout.y + w.layout.h))
      : 0;
    const widget: WidgetConfig = {
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      type: item.type,
      layout: { x: 0, y: bottomY, w: item.defaultSize.w, h: item.defaultSize.h },
      settings: { ...item.defaultSettings },
    };
    onAdd(widget);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Widget</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {CATEGORIES.map((cat) => {
            const items = WIDGET_PICKER_ITEMS.filter(cat.filter);
            if (items.length === 0) return null;
            return (
              <div key={cat.label}>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  {cat.label}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.key}
                        onClick={() => handleSelect(item)}
                        className="flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
                      >
                        <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-tight">{item.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                            {item.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
