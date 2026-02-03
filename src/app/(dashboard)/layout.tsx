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
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col gap-2">
              <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6 flex-1">
                {children}
              </div>
            </div>
          </div>
        </SidebarInset>
      </DashboardSidebarProvider>
    </HeaderProvider>
  );
}
