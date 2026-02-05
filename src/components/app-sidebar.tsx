"use client";

import * as React from "react";
import {
  IconTarget,
} from "@tabler/icons-react";
import { ChartLine, Gem, Box } from "lucide-react";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { SidebarResizeHandle } from "@/components/sidebar-resize-handle";

const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: ChartLine,
    },
    {
      title: "Features",
      url: "/dashboard/features",
      icon: Box,
    },
    {
      title: "Milestones",
      url: "/dashboard/milestones",
      icon: Gem,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar
      collapsible="offcanvas"
      className="overflow-x-hidden"
      resizeHandle={<SidebarResizeHandle />}
      {...props}
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="/dashboard">
                <IconTarget className="!size-5" />
                <span className="text-base font-semibold">Shronk</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="overflow-x-hidden scrollbar-none">
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
