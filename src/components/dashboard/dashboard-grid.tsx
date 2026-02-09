"use client";

import { useMemo, useCallback } from "react";
import {
  ResponsiveGridLayout,
  useContainerWidth,
  verticalCompactor,
} from "react-grid-layout";
import type { Layout } from "react-grid-layout";
import type { WidgetConfig } from "@/types/dashboard";
import { WIDGET_REGISTRY } from "./widget-registry";
import { cn } from "@/lib/utils";
import "react-grid-layout/css/styles.css";

interface DashboardGridProps {
  widgets: WidgetConfig[];
  isEditMode: boolean;
  onLayoutChange?: (widgets: WidgetConfig[]) => void;
  children: (widget: WidgetConfig) => React.ReactNode;
}

export function DashboardGrid({
  widgets,
  isEditMode,
  onLayoutChange,
  children,
}: DashboardGridProps) {
  const { width, containerRef, mounted } = useContainerWidth();

  const layouts = useMemo(() => {
    const lg: Layout = widgets.map((w) => {
      const def = WIDGET_REGISTRY[w.type];
      return {
        i: w.id,
        x: w.layout.x,
        y: w.layout.y,
        w: w.layout.w,
        h: w.layout.h,
        minW: def?.minSize.w ?? 2,
        minH: def?.minSize.h ?? 2,
        maxW: def?.maxSize.w ?? 12,
        maxH: def?.maxSize.h ?? 10,
      };
    });
    return { lg };
  }, [widgets]);

  const handleLayoutChange = useCallback(
    (layout: Layout) => {
      if (!isEditMode || !onLayoutChange) return;
      const updated = widgets.map((w) => {
        const item = (layout as unknown as Array<{ i: string; x: number; y: number; w: number; h: number }>).find(
          (l) => l.i === w.id
        );
        if (!item) return w;
        return {
          ...w,
          layout: { x: item.x, y: item.y, w: item.w, h: item.h },
        };
      });
      onLayoutChange(updated);
    },
    [isEditMode, onLayoutChange, widgets]
  );

  return (
    <div ref={containerRef}>
      {mounted && (
        <ResponsiveGridLayout
          className="layout"
          width={width}
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 12, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={60}
          margin={[16, 16] as const}
          dragConfig={{
            enabled: isEditMode,
            bounded: false,
            handle: ".drag-handle",
            threshold: 3,
          }}
          resizeConfig={{
            enabled: isEditMode,
            handles: ["se", "s", "e"] as const,
          }}
          compactor={verticalCompactor}
          onLayoutChange={handleLayoutChange}
        >
          {widgets.map((widget) => (
            <div
              key={widget.id}
              className={cn(
                "h-full",
                isEditMode && "ring-1 ring-border/50 rounded-lg"
              )}
            >
              {children(widget)}
            </div>
          ))}
        </ResponsiveGridLayout>
      )}
    </div>
  );
}
