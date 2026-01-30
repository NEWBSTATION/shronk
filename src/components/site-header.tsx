"use client";

import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useHeader } from "@/components/header-context";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/projects": "Features",
  "/dashboard/features": "Features",
  "/dashboard/milestones": "Milestones",
  "/dashboard/settings": "Settings",
  "/dashboard/help": "Help",
};

export function SiteHeader() {
  const pathname = usePathname();
  const { breadcrumbs, headerAction } = useHeader();
  const title = pageTitles[pathname] || "Dashboard";

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center justify-between gap-1 px-4 lg:gap-2 lg:px-6">
        <div className="flex items-center gap-1">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mx-2 data-[orientation=vertical]:h-4"
          />
          <div className="flex items-center gap-1.5">
            {breadcrumbs.length > 0 ? (
              <>
                <button
                  onClick={breadcrumbs[0].onClick}
                  className="text-base font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  {title}
                </button>
                {breadcrumbs.map((crumb, index) => (
                  <div key={index} className="flex items-center gap-1.5">
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    <span className="text-base font-medium">{crumb.label}</span>
                  </div>
                ))}
              </>
            ) : (
              <h1 className="text-base font-medium">{title}</h1>
            )}
          </div>
        </div>
        {headerAction && (
          <div className="flex items-center">
            {headerAction}
          </div>
        )}
      </div>
    </header>
  );
}
