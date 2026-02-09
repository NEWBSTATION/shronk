"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { WidgetConfig, GlobalFilters } from "@/types/dashboard";

interface DashboardLayoutResponse {
  widgets: WidgetConfig[];
  globalFilters: GlobalFilters;
  isDefault?: boolean;
}

export function useDashboardLayout(projectId: string) {
  return useQuery<DashboardLayoutResponse>({
    queryKey: ["dashboard-layout", projectId],
    queryFn: async () => {
      const res = await fetch(
        `/api/dashboard-layouts?projectId=${projectId}`
      );
      if (!res.ok) throw new Error("Failed to fetch dashboard layout");
      return res.json();
    },
    enabled: !!projectId,
  });
}

export function useSaveDashboardLayout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      projectId: string;
      widgets: WidgetConfig[];
      globalFilters?: GlobalFilters;
    }) => {
      const res = await fetch("/api/dashboard-layouts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save dashboard layout");
      }
      return res.json() as Promise<DashboardLayoutResponse>;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["dashboard-layout", variables.projectId],
      });
    },
  });
}
