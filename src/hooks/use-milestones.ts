"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  Milestone,
  NewMilestone,
  MilestoneDependency,
  Team,
} from "@/db/schema";

interface MilestonesResponse {
  milestones: Milestone[];
  dependencies: MilestoneDependency[];
}

export interface CascadedUpdate {
  id: string;
  startDate: string;
  endDate: string;
  duration?: number;
}

interface MilestoneUpdateResponse {
  milestone: Milestone;
  cascadedUpdates: CascadedUpdate[];
}

interface FetchMilestonesParams {
  projectId: string;
  status?: string[];
  priority?: string[];
  teamId?: string[];
  search?: string;
  sortField?: string;
  sortDirection?: string;
}

async function fetchMilestones(
  params: FetchMilestonesParams
): Promise<MilestonesResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set("projectId", params.projectId);

  if (params.status?.length) {
    params.status.forEach((s) => searchParams.append("status", s));
  }
  if (params.priority?.length) {
    params.priority.forEach((p) => searchParams.append("priority", p));
  }
  if (params.teamId?.length) {
    params.teamId.forEach((t) => searchParams.append("teamId", t));
  }
  if (params.search) {
    searchParams.set("search", params.search);
  }
  if (params.sortField) {
    searchParams.set("sortField", params.sortField);
  }
  if (params.sortDirection) {
    searchParams.set("sortDirection", params.sortDirection);
  }

  const response = await fetch(`/api/milestones?${searchParams.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to fetch milestones");
  }
  return response.json();
}

export function useMilestones(params: FetchMilestonesParams) {
  return useQuery({
    queryKey: ["milestones", params],
    queryFn: () => fetchMilestones(params),
    enabled: !!params.projectId,
  });
}

export function useCreateMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<NewMilestone, "id" | "createdAt" | "updatedAt">) => {
      const response = await fetch("/api/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          startDate: data.startDate instanceof Date
            ? data.startDate.toISOString()
            : data.startDate,
          endDate: data.endDate instanceof Date
            ? data.endDate.toISOString()
            : data.endDate,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create milestone");
      }
      return response.json() as Promise<Milestone>;
    },
    onSuccess: (newMilestone) => {
      queryClient.invalidateQueries({
        queryKey: ["milestones", { projectId: newMilestone.projectId }],
      });
    },
  });
}

export function useUpdateMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: Partial<Milestone> & { id: string; duration?: number }) => {
      const body: Record<string, unknown> = { ...data };
      if (data.startDate) {
        body.startDate =
          data.startDate instanceof Date
            ? data.startDate.toISOString()
            : data.startDate;
      }
      if (data.endDate) {
        body.endDate =
          data.endDate instanceof Date
            ? data.endDate.toISOString()
            : data.endDate;
      }

      const response = await fetch(`/api/milestones/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update milestone");
      }
      return response.json() as Promise<MilestoneUpdateResponse>;
    },
    onMutate: async ({ id, ...data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["milestones"] });

      // Snapshot previous value
      const previousData = queryClient.getQueriesData({ queryKey: ["milestones"] });

      // Optimistically update
      queryClient.setQueriesData(
        { queryKey: ["milestones"] },
        (old: MilestonesResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            milestones: old.milestones.map((m) =>
              m.id === id ? { ...m, ...data } : m
            ),
          };
        }
      );

      return { previousData };
    },
    onSuccess: (data) => {
      // Apply cascaded updates to the cache immediately (before invalidation refetch)
      if (data.cascadedUpdates?.length) {
        queryClient.setQueriesData(
          { queryKey: ["milestones"] },
          (old: MilestonesResponse | undefined) => {
            if (!old) return old;
            const updateMap = new Map(
              data.cascadedUpdates.map((u) => [u.id, u])
            );
            return {
              ...old,
              milestones: old.milestones.map((m) => {
                const update = updateMap.get(m.id);
                if (update) {
                  return {
                    ...m,
                    startDate: update.startDate,
                    endDate: update.endDate,
                    ...(update.duration !== undefined ? { duration: update.duration } : {}),
                  };
                }
                return m;
              }),
            };
          }
        );
      }
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
    },
  });
}

interface MilestoneDeleteResponse {
  success: boolean;
  cascadedUpdates: CascadedUpdate[];
}

export function useDeleteMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/milestones/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete milestone");
      }
      return response.json() as Promise<MilestoneDeleteResponse>;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["milestones"] });
      const previousData = queryClient.getQueriesData({ queryKey: ["milestones"] });

      queryClient.setQueriesData(
        { queryKey: ["milestones"] },
        (old: MilestonesResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            milestones: old.milestones.filter((m) => m.id !== id),
            dependencies: old.dependencies.filter(
              (d) => d.predecessorId !== id && d.successorId !== id
            ),
          };
        }
      );

      return { previousData };
    },
    onSuccess: (data) => {
      // Apply cascaded updates from deletion reflow
      if (data.cascadedUpdates?.length) {
        queryClient.setQueriesData(
          { queryKey: ["milestones"] },
          (old: MilestonesResponse | undefined) => {
            if (!old) return old;
            const updateMap = new Map(
              data.cascadedUpdates.map((u) => [u.id, u])
            );
            return {
              ...old,
              milestones: old.milestones.map((m) => {
                const update = updateMap.get(m.id);
                if (update) {
                  return {
                    ...m,
                    startDate: update.startDate,
                    endDate: update.endDate,
                    ...(update.duration !== undefined ? { duration: update.duration } : {}),
                  };
                }
                return m;
              }),
            };
          }
        );
      }
    },
    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
    },
  });
}

export function useBulkUpdateMilestones() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      ids,
      updates,
    }: {
      ids: string[];
      updates: Partial<Pick<Milestone, "status" | "priority" | "teamId" | "progress">>;
    }) => {
      const response = await fetch("/api/milestones/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, updates }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to bulk update milestones");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
    },
  });
}

export function useBulkDeleteMilestones() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const response = await fetch("/api/milestones/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to bulk delete milestones");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
    },
  });
}

export function useReorderMilestones() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      items,
    }: {
      projectId: string;
      items: Array<{ id: string; sortOrder: number }>;
    }) => {
      const response = await fetch("/api/milestones/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, items }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to reorder milestones");
      }
      return response.json();
    },
    onMutate: async ({ items }) => {
      await queryClient.cancelQueries({ queryKey: ["milestones"] });
      const previousData = queryClient.getQueriesData({ queryKey: ["milestones"] });

      queryClient.setQueriesData(
        { queryKey: ["milestones"] },
        (old: MilestonesResponse | undefined) => {
          if (!old) return old;
          const orderMap = new Map(items.map((i) => [i.id, i.sortOrder]));
          return {
            ...old,
            milestones: old.milestones
              .map((m) => ({
                ...m,
                sortOrder: orderMap.get(m.id) ?? m.sortOrder,
              }))
              .sort((a, b) => a.sortOrder - b.sortOrder),
          };
        }
      );

      return { previousData };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
    },
  });
}

// Dependencies hooks
export function useDependencies(projectId: string) {
  return useQuery({
    queryKey: ["dependencies", projectId],
    queryFn: async () => {
      const response = await fetch(
        `/api/dependencies?projectId=${projectId}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch dependencies");
      }
      return response.json() as Promise<{ dependencies: MilestoneDependency[] }>;
    },
    enabled: !!projectId,
  });
}

interface DependencyCreateResponse {
  dependency: MilestoneDependency;
  cascadedUpdates: CascadedUpdate[];
}

export function useCreateDependency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { predecessorId: string; successorId: string }) => {
      const response = await fetch("/api/dependencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create dependency");
      }
      return response.json() as Promise<DependencyCreateResponse>;
    },
    onSuccess: (data) => {
      // Apply cascaded updates to milestones cache
      if (data.cascadedUpdates?.length) {
        queryClient.setQueriesData(
          { queryKey: ["milestones"] },
          (old: MilestonesResponse | undefined) => {
            if (!old) return old;
            const updateMap = new Map(
              data.cascadedUpdates.map((u) => [u.id, u])
            );
            return {
              ...old,
              milestones: old.milestones.map((m) => {
                const update = updateMap.get(m.id);
                if (update) {
                  return {
                    ...m,
                    startDate: update.startDate,
                    endDate: update.endDate,
                    ...(update.duration !== undefined ? { duration: update.duration } : {}),
                  };
                }
                return m;
              }),
            };
          }
        );
      }
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
      queryClient.invalidateQueries({ queryKey: ["dependencies"] });
    },
  });
}

interface DependencyDeleteResponse {
  success: boolean;
  cascadedUpdates: CascadedUpdate[];
}

export function useDeleteDependency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch("/api/dependencies", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete dependency");
      }
      return response.json() as Promise<DependencyDeleteResponse>;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["milestones"] });
      const previousData = queryClient.getQueriesData({ queryKey: ["milestones"] });

      queryClient.setQueriesData(
        { queryKey: ["milestones"] },
        (old: MilestonesResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            dependencies: old.dependencies.filter((d) => d.id !== id),
          };
        }
      );

      return { previousData };
    },
    onSuccess: (data) => {
      // Apply cascaded updates from dependency removal
      if (data.cascadedUpdates?.length) {
        queryClient.setQueriesData(
          { queryKey: ["milestones"] },
          (old: MilestonesResponse | undefined) => {
            if (!old) return old;
            const updateMap = new Map(
              data.cascadedUpdates.map((u) => [u.id, u])
            );
            return {
              ...old,
              milestones: old.milestones.map((m) => {
                const update = updateMap.get(m.id);
                if (update) {
                  return {
                    ...m,
                    startDate: update.startDate,
                    endDate: update.endDate,
                    ...(update.duration !== undefined ? { duration: update.duration } : {}),
                  };
                }
                return m;
              }),
            };
          }
        );
      }
    },
    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
      queryClient.invalidateQueries({ queryKey: ["dependencies"] });
    },
  });
}

// Projects hook
export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const response = await fetch("/api/projects");
      if (!response.ok) {
        throw new Error("Failed to fetch projects");
      }
      return response.json() as Promise<{ projects: import("@/db/schema").Project[] }>;
    },
  });
}

// Milestone stats hook (for overview)
export interface MilestoneStats {
  milestoneId: string;
  featureCount: number;
  completedFeatureCount: number;
}

export function useMilestoneStats() {
  return useQuery({
    queryKey: ["milestoneStats"],
    queryFn: async () => {
      const response = await fetch("/api/projects/stats");
      if (!response.ok) {
        throw new Error("Failed to fetch milestone stats");
      }
      return response.json() as Promise<{ stats: MilestoneStats[] }>;
    },
  });
}

// Teams hooks
export function useTeams(projectId: string) {
  return useQuery({
    queryKey: ["teams", projectId],
    queryFn: async () => {
      const response = await fetch(`/api/teams?projectId=${projectId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch teams");
      }
      return response.json() as Promise<{ teams: Team[] }>;
    },
    enabled: !!projectId,
  });
}

export function useCreateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { projectId: string; name: string; color?: string }) => {
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create team");
      }
      return response.json() as Promise<Team>;
    },
    onSuccess: (newTeam) => {
      queryClient.invalidateQueries({
        queryKey: ["teams", newTeam.projectId],
      });
    },
  });
}
