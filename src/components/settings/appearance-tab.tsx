"use client";

import { ThemeSelector } from "@/components/theme-selector";

export function AppearanceTab() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Theme
        </h3>
        <div className="rounded-lg border">
          <div className="px-4 py-4">
            <ThemeSelector />
          </div>
        </div>
      </div>
    </div>
  );
}
