"use client";

import * as React from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useLayoutStore } from "@/store/layout-store";

interface DashboardSidebarProviderProps {
  children: React.ReactNode;
}

export function DashboardSidebarProvider({
  children,
}: DashboardSidebarProviderProps) {
  const sidebarWidth = useLayoutStore((s) => s.sidebarWidth);

  return (
    <SidebarProvider
      className="h-svh max-h-svh overflow-hidden"
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      {children}
    </SidebarProvider>
  );
}
