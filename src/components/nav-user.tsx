"use client";

import { UserButton } from "@clerk/nextjs";
import { ThemeSelectorCompact } from "@/components/theme-selector";

import {
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function NavUser() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className="flex items-center justify-between w-full px-2 py-1.5">
          <UserButton afterSignOutUrl="/" />
          <ThemeSelectorCompact />
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
