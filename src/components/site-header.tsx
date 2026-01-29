"use client";

import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/projects": "Features",
  "/dashboard/milestones": "Milestones",
  "/dashboard/settings": "Settings",
  "/dashboard/help": "Help",
};

const pageActions: Record<string, { label: string; action?: string }> = {
  "/dashboard/projects": { label: "Add feature" },
  "/dashboard/milestones": { label: "Add milestone" },
};

export function SiteHeader() {
  const pathname = usePathname();
  const title = pageTitles[pathname] || "Dashboard";
  const action = pageActions[pathname];

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{title}</h1>
        {action && (
          <div className="ml-auto">
            <Button size="sm" className="h-7 text-xs">
              <Plus className="h-3.5 w-3.5" />
              {action.label}
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
