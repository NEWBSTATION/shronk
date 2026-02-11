"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  Milestone,
  NewMilestone,
  MilestoneDependency,
  Team,
  TeamMilestoneDuration,
} from "@/db/schema";

interface MilestonesResponse {
  milestones: Milestone[];
  dependencies: MilestoneDependency[];
  teamDurations: TeamMilestoneDuration[];
}

export interface CascadedUpdate {
  id: string;
  startDate: string;
  endDate: string;
  duration?: number;
}

export interface TeamCascadedUpdate {
  teamId: string;
  id: string;
  startDate: string;
  endDate: string;
  duration: number;
}

interface MilestoneUpdateResponse {
  milestone: Milestone;
  cascadedUpdates: CascadedUpdate[];
  teamCascadedUpdates?: TeamCascadedUpdate[];
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
      if (data.cascadedUpdates?.length || data.teamCascadedUpdates?.length) {
        queryClient.setQueriesData(
          { queryKey: ["milestones"] },
          (old: MilestonesResponse | undefined) => {
            if (!old) return old;
            const updateMap = new Map(
              (data.cascadedUpdates || []).map((u) => [u.id, u])
            );
            const newMilestones = old.milestones.map((m) => {
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
            });

            // Apply team cascaded updates
            let newTeamDurations = old.teamDurations || [];
            if (data.teamCascadedUpdates?.length) {
              const teamUpdateMap = new Map(
                data.teamCascadedUpdates.map((u) => [`${u.id}__${u.teamId}`, u])
              );
              newTeamDurations = newTeamDurations.map((td) => {
                const update = teamUpdateMap.get(`${td.milestoneId}__${td.teamId}`);
                if (update) {
                  return {
                    ...td,
                    startDate: new Date(update.startDate),
                    endDate: new Date(update.endDate),
                    duration: update.duration,
                  };
                }
                return td;
              });
            }

            return { ...old, milestones: newMilestones, teamDurations: newTeamDurations };
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
  teamCascadedUpdates?: TeamCascadedUpdate[];
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
            teamDurations: (old.teamDurations || []).filter(
              (td) => td.milestoneId !== id
            ),
          };
        }
      );

      return { previousData };
    },
    onSuccess: (data) => {
      // Apply cascaded updates from deletion reflow
      if (data.cascadedUpdates?.length || data.teamCascadedUpdates?.length) {
        queryClient.setQueriesData(
          { queryKey: ["milestones"] },
          (old: MilestonesResponse | undefined) => {
            if (!old) return old;
            const updateMap = new Map(
              (data.cascadedUpdates || []).map((u) => [u.id, u])
            );
            const newMilestones = old.milestones.map((m) => {
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
            });

            let newTeamDurations = old.teamDurations || [];
            if (data.teamCascadedUpdates?.length) {
              const teamUpdateMap = new Map(
                data.teamCascadedUpdates.map((u) => [`${u.id}__${u.teamId}`, u])
              );
              newTeamDurations = newTeamDurations.map((td) => {
                const update = teamUpdateMap.get(`${td.milestoneId}__${td.teamId}`);
                if (update) {
                  return { ...td, startDate: new Date(update.startDate), endDate: new Date(update.endDate), duration: update.duration };
                }
                return td;
              });
            }

            return { ...old, milestones: newMilestones, teamDurations: newTeamDurations };
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
  teamCascadedUpdates?: TeamCascadedUpdate[];
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
      if (data.cascadedUpdates?.length || data.teamCascadedUpdates?.length) {
        queryClient.setQueriesData(
          { queryKey: ["milestones"] },
          (old: MilestonesResponse | undefined) => {
            if (!old) return old;
            const updateMap = new Map(
              (data.cascadedUpdates || []).map((u) => [u.id, u])
            );
            const newMilestones = old.milestones.map((m) => {
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
            });

            let newTeamDurations = old.teamDurations || [];
            if (data.teamCascadedUpdates?.length) {
              const teamUpdateMap = new Map(
                data.teamCascadedUpdates.map((u) => [`${u.id}__${u.teamId}`, u])
              );
              newTeamDurations = newTeamDurations.map((td) => {
                const update = teamUpdateMap.get(`${td.milestoneId}__${td.teamId}`);
                if (update) {
                  return { ...td, startDate: new Date(update.startDate), endDate: new Date(update.endDate), duration: update.duration };
                }
                return td;
              });
            }

            return { ...old, milestones: newMilestones, teamDurations: newTeamDurations };
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
  teamCascadedUpdates?: TeamCascadedUpdate[];
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
      if (data.cascadedUpdates?.length || data.teamCascadedUpdates?.length) {
        queryClient.setQueriesData(
          { queryKey: ["milestones"] },
          (old: MilestonesResponse | undefined) => {
            if (!old) return old;
            const updateMap = new Map(
              (data.cascadedUpdates || []).map((u) => [u.id, u])
            );
            const newMilestones = old.milestones.map((m) => {
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
            });

            let newTeamDurations = old.teamDurations || [];
            if (data.teamCascadedUpdates?.length) {
              const teamUpdateMap = new Map(
                data.teamCascadedUpdates.map((u) => [`${u.id}__${u.teamId}`, u])
              );
              newTeamDurations = newTeamDurations.map((td) => {
                const update = teamUpdateMap.get(`${td.milestoneId}__${td.teamId}`);
                if (update) {
                  return { ...td, startDate: new Date(update.startDate), endDate: new Date(update.endDate), duration: update.duration };
                }
                return td;
              });
            }

            return { ...old, milestones: newMilestones, teamDurations: newTeamDurations };
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

export function useUpdateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { id: string; name?: string; color?: string }) => {
      const response = await fetch("/api/teams", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update team");
      }
      return response.json() as Promise<Team>;
    },
    onSuccess: (updatedTeam) => {
      queryClient.invalidateQueries({
        queryKey: ["teams", updatedTeam.projectId],
      });
    },
  });
}

export function useDeleteTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const response = await fetch("/api/teams", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete team");
      }
      return { id, projectId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["teams", variables.projectId],
      });
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
    },
  });
}

// Team duration hooks
interface TeamDurationUpsertResponse {
  teamDuration: TeamMilestoneDuration;
  teamCascadedUpdates: TeamCascadedUpdate[];
}

export function useUpsertTeamDuration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      milestoneId: string;
      teamId: string;
      duration: number;
    }) => {
      const response = await fetch("/api/team-durations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upsert team duration");
      }
      return response.json() as Promise<TeamDurationUpsertResponse>;
    },
    onSuccess: (data) => {
      // Apply the upserted duration + cascaded updates to cache
      queryClient.setQueriesData(
        { queryKey: ["milestones"] },
        (old: MilestonesResponse | undefined) => {
          if (!old) return old;
          let teamDurations = old.teamDurations || [];

          // Upsert the returned team duration
          const td = data.teamDuration;
          const existingIdx = teamDurations.findIndex(
            (d) => d.milestoneId === td.milestoneId && d.teamId === td.teamId
          );
          if (existingIdx >= 0) {
            teamDurations = teamDurations.map((d, i) =>
              i === existingIdx ? td : d
            );
          } else {
            teamDurations = [...teamDurations, td];
          }

          // Apply cascaded updates
          if (data.teamCascadedUpdates?.length) {
            const updateMap = new Map(
              data.teamCascadedUpdates.map((u) => [`${u.id}__${u.teamId}`, u])
            );
            teamDurations = teamDurations.map((d) => {
              const update = updateMap.get(`${d.milestoneId}__${d.teamId}`);
              if (update) {
                return {
                  ...d,
                  startDate: new Date(update.startDate),
                  endDate: new Date(update.endDate),
                  duration: update.duration,
                };
              }
              return d;
            });
          }

          return { ...old, teamDurations };
        }
      );
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
    },
  });
}

interface TeamDurationDeleteResponse {
  success: boolean;
  teamCascadedUpdates: TeamCascadedUpdate[];
}

export function useDeleteTeamDuration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { milestoneId: string; teamId: string }) => {
      const response = await fetch("/api/team-durations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete team duration");
      }
      return response.json() as Promise<TeamDurationDeleteResponse>;
    },
    onSuccess: (data, variables) => {
      queryClient.setQueriesData(
        { queryKey: ["milestones"] },
        (old: MilestonesResponse | undefined) => {
          if (!old) return old;
          let teamDurations = (old.teamDurations || []).filter(
            (d) =>
              !(
                d.milestoneId === variables.milestoneId &&
                d.teamId === variables.teamId
              )
          );

          if (data.teamCascadedUpdates?.length) {
            const updateMap = new Map(
              data.teamCascadedUpdates.map((u) => [`${u.id}__${u.teamId}`, u])
            );
            teamDurations = teamDurations.map((d) => {
              const update = updateMap.get(`${d.milestoneId}__${d.teamId}`);
              if (update) {
                return { ...d, startDate: new Date(update.startDate), endDate: new Date(update.endDate), duration: update.duration };
              }
              return d;
            });
          }

          return { ...old, teamDurations };
        }
      );
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
    },
  });
}
