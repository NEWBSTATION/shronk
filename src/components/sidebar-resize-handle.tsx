"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  useLayoutStore,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_MAX_WIDTH,
} from "@/store/layout-store";
import { useSidebar } from "@/components/ui/sidebar";

export function SidebarResizeHandle() {
  const { state, isMobile } = useSidebar();
  const setSidebarWidth = useLayoutStore((s) => s.setSidebarWidth);
  const [isDragging, setIsDragging] = React.useState(false);

  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
    },
    []
  );

  React.useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX;
      setSidebarWidth(
        Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, newWidth))
      );
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, setSidebarWidth]);

  // Don't show resize handle when sidebar is collapsed or on mobile
  if (state === "collapsed" || isMobile) {
    return null;
  }

  return (
    <>
      {/* Overlay to capture mouse events while dragging */}
      {isDragging && (
        <div className="fixed inset-0 z-50 cursor-col-resize select-none" />
      )}
      {/* Resize handle at the far right edge of the sidebar container */}
      <div
        onMouseDown={handleMouseDown}
        className={cn(
          "absolute top-0 right-0 z-20 h-full w-3 cursor-col-resize group/resize py-2",
          "flex items-center justify-end"
        )}
      >
        {/* Visual indicator - positioned at the far right edge, matches main content radius */}
        <div
          className={cn(
            "h-full w-[3px] rounded-xl transition-colors",
            "group-hover/resize:bg-primary/30",
            isDragging && "bg-primary/50"
          )}
        />
      </div>
    </>
  );
}
