"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset } from "@/components/ui/sidebar";
import { HeaderProvider } from "@/components/header-context";
import { DashboardSidebarProvider } from "@/components/dashboard-sidebar-provider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <HeaderProvider>
      <DashboardSidebarProvider>
        <AppSidebar variant="inset" />
        <SidebarInset className="min-h-0">
          <SiteHeader />
          <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
            <div className="@container/main flex flex-1 flex-col min-h-0">
              <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6 flex-1 min-h-0">
                {children}
              </div>
            </div>
          </div>
        </SidebarInset>
      </DashboardSidebarProvider>
    </HeaderProvider>
  );
}
