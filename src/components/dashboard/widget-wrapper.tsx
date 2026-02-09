"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GripVertical, Settings, X } from "lucide-react";
import type { WidgetConfig } from "@/types/dashboard";

interface WidgetWrapperProps {
  config: WidgetConfig;
  isEditMode: boolean;
  onSettings?: (config: WidgetConfig) => void;
  onDelete?: (id: string) => void;
  children: React.ReactNode;
}

export function WidgetWrapper({
  config,
  isEditMode,
  onSettings,
  onDelete,
  children,
}: WidgetWrapperProps) {
  const title = config.settings.title || config.type;

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {isEditMode && (
            <div className="drag-handle cursor-grab active:cursor-grabbing">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <CardTitle className="text-sm font-medium truncate">
            {title}
          </CardTitle>
        </div>
        {isEditMode && (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                onSettings?.(config);
              }}
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(config.id);
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-1 min-h-0 overflow-auto">{children}</CardContent>
    </Card>
  );
}
