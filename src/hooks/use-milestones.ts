"use client";

import { useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { addDays, differenceInDays } from "date-fns";
import { getTransitiveSuccessors } from "@/lib/graph-utils";
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
  offset: number;
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
  const pendingDragCount = useRef(0);
  const dragMutex = useRef<Promise<unknown>>(Promise.resolve());

  return useMutation({
    mutationFn: async ({
      id,
      dragType,
      originalStartDate,
      originalEndDate,
      ...data
    }: Partial<Milestone> & {
      id: string;
      duration?: number;
      dragType?: 'move' | 'resize-start' | 'resize-end';
      originalStartDate?: Date;
      originalEndDate?: Date;
    }) => {
      const body: Record<string, unknown> = { ...data };
      if (dragType) body.dragType = dragType;
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
      // Send pre-drag original dates so server computes delta from correct base
      // (prevents race conditions with overlapping requests)
      if (originalStartDate) {
        body.originalStartDate = originalStartDate.toISOString();
      }
      if (originalEndDate) {
        body.originalEndDate = originalEndDate.toISOString();
      }

      const execute = async () => {
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
      };

      // Serialize drag mutations to prevent concurrent requests reading stale DB state
      if (dragType) {
        const chained = dragMutex.current.then(execute, execute);
        dragMutex.current = chained.catch(() => {});
        return chained;
      }

      return execute();
    },
    onMutate: async ({ id, dragType, originalStartDate, originalEndDate, ...data }) => {
      if (dragType === "move" || dragType === "resize-end") {
        pendingDragCount.current++;
      }

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["milestones"] });

      // Snapshot previous value
      const previousData = queryClient.getQueriesData({ queryKey: ["milestones"] });

      // Optimistically update
      queryClient.setQueriesData(
        { queryKey: ["milestones"] },
        (old: MilestonesResponse | undefined) => {
          if (!old) return old;

          let newMilestones = old.milestones.map((m) =>
            m.id === id ? { ...m, ...data } : m
          );
          let newTeamDurations = old.teamDurations || [];

          // For move/resize-end drags, optimistically shift transitive successors
          // so there's no visual flash between cleanup and server response
          if ((dragType === "move" || dragType === "resize-end") && data.startDate && data.endDate) {
            const existing = old.milestones.find((m) => m.id === id);
            if (existing) {
              // Always use cache position for optimistic delta — not originalStartDate
              // (which is for the server). Cache position reflects prior optimistic
              // shifts, so the delta is incremental and accumulates correctly.
              const oldStart = new Date(existing.startDate);
              const oldEnd = new Date(existing.endDate);
              const newStart = new Date(data.startDate as string | Date);
              const newEnd = new Date(data.endDate as string | Date);

              const delta =
                dragType === "move"
                  ? differenceInDays(newStart, oldStart)
                  : differenceInDays(newEnd, oldEnd);

              if (delta !== 0) {
                const successorMap = new Map<string, string[]>();
                for (const dep of old.dependencies) {
                  const list = successorMap.get(dep.predecessorId) || [];
                  list.push(dep.successorId);
                  successorMap.set(dep.predecessorId, list);
                }

                const successorIds = getTransitiveSuccessors(id, successorMap);

                if (successorIds.size > 0) {
                  newMilestones = newMilestones.map((m) => {
                    if (!successorIds.has(m.id)) return m;
                    return {
                      ...m,
                      startDate: addDays(new Date(m.startDate), delta),
                      endDate: addDays(new Date(m.endDate), delta),
                    };
                  });

                  // Shift team durations for successors + dragged node on move
                  const teamShiftIds = new Set(successorIds);
                  if (dragType === "move") teamShiftIds.add(id);

                  if (newTeamDurations.length > 0) {
                    newTeamDurations = newTeamDurations.map((td) => {
                      if (!teamShiftIds.has(td.milestoneId)) return td;
                      return {
                        ...td,
                        startDate: addDays(new Date(td.startDate), delta),
                        endDate: addDays(new Date(td.endDate), delta),
                      };
                    });
                  }
                }
              }
            }
          }

          return { ...old, milestones: newMilestones, teamDurations: newTeamDurations };
        }
      );

      return { previousData };
    },
    onSuccess: (data, variables) => {
      // For move/resize-end drags, skip applying cascaded updates — onMutate already
      // shifted successors optimistically, and stale server responses from earlier
      // mutations would overwrite the correct optimistic positions of newer mutations.
      // onSettled's refetch will reconcile the final state.
      if (variables.dragType === "move" || variables.dragType === "resize-end") return;

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
                    offset: update.offset,
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
    onSettled: (_data, _error, variables) => {
      if (variables.dragType === "move" || variables.dragType === "resize-end") {
        pendingDragCount.current--;
      }
      // Only refetch when no drag mutations have in-flight optimistic state —
      // earlier refetches would clobber newer optimistic positions
      if (pendingDragCount.current <= 0) {
        pendingDragCount.current = 0;
        queryClient.invalidateQueries({ queryKey: ["milestones"] });
      }
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
                  return { ...td, startDate: new Date(update.startDate), endDate: new Date(update.endDate), duration: update.duration, offset: update.offset };
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
      updates: Partial<Pick<Milestone, "status" | "priority" | "progress">>;
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

// Feature reorder hook
interface ReorderFeaturesResponse {
  success: boolean;
  cascadedUpdates: CascadedUpdate[];
  teamCascadedUpdates?: TeamCascadedUpdate[];
  newRootUpdate: CascadedUpdate & { duration: number };
}

export function useReorderFeatures() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      orderedFeatureIds,
    }: {
      projectId: string;
      orderedFeatureIds: string[];
    }) => {
      const response = await fetch("/api/features/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, orderedFeatureIds }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to reorder features");
      }
      return response.json() as Promise<ReorderFeaturesResponse>;
    },
    onSuccess: (data, variables) => {
      // Apply all cascaded updates + root update to caches
      const allUpdates = [
        data.newRootUpdate,
        ...(data.cascadedUpdates || []),
      ];
      const updateMap = new Map(allUpdates.map((u) => [u.id, u]));

      // Build sortOrder map from the new order
      const sortOrderMap = new Map(
        variables.orderedFeatureIds.map((id, i) => [id, i])
      );

      queryClient.setQueriesData(
        { queryKey: ["milestones"] },
        (old: MilestonesResponse | undefined) => {
          if (!old) return old;
          const newMilestones = old.milestones.map((m) => {
            const update = updateMap.get(m.id);
            const newSortOrder = sortOrderMap.get(m.id);
            if (update || newSortOrder !== undefined) {
              return {
                ...m,
                ...(update
                  ? {
                      startDate: update.startDate,
                      endDate: update.endDate,
                      ...(update.duration !== undefined
                        ? { duration: update.duration }
                        : {}),
                    }
                  : {}),
                ...(newSortOrder !== undefined
                  ? { sortOrder: newSortOrder }
                  : {}),
              };
            }
            return m;
          });

          let newTeamDurations = old.teamDurations || [];
          if (data.teamCascadedUpdates?.length) {
            const teamUpdateMap = new Map(
              data.teamCascadedUpdates.map((u) => [
                `${u.id}__${u.teamId}`,
                u,
              ])
            );
            newTeamDurations = newTeamDurations.map((td) => {
              const update = teamUpdateMap.get(
                `${td.milestoneId}__${td.teamId}`
              );
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

          // Sort by new sortOrder so the cache reflects the reorder immediately
          newMilestones.sort((a, b) => a.sortOrder - b.sortOrder);

          return {
            ...old,
            milestones: newMilestones,
            teamDurations: newTeamDurations,
          };
        }
      );

      queryClient.invalidateQueries({ queryKey: ["milestones"] });
      queryClient.invalidateQueries({ queryKey: ["dependencies"] });
      queryClient.invalidateQueries({ queryKey: ["allFeatures"] });
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
    mutationFn: async (data: { predecessorId: string; successorId: string; skipReflow?: boolean }) => {
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
                  return { ...td, startDate: new Date(update.startDate), endDate: new Date(update.endDate), duration: update.duration, offset: update.offset };
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
                  return { ...td, startDate: new Date(update.startDate), endDate: new Date(update.endDate), duration: update.duration, offset: update.offset };
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

// Update dependency lag
interface DependencyUpdateResponse {
  dependency: MilestoneDependency;
  cascadedUpdates: CascadedUpdate[];
  teamCascadedUpdates?: TeamCascadedUpdate[];
}

export function useUpdateDependencyLag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { id: string; lag: number }) => {
      const response = await fetch("/api/dependencies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update dependency lag");
      }
      return response.json() as Promise<DependencyUpdateResponse>;
    },
    onSuccess: (data) => {
      // Update dependency lag in cache
      queryClient.setQueriesData(
        { queryKey: ["milestones"] },
        (old: MilestonesResponse | undefined) => {
          if (!old) return old;
          const newDeps = old.dependencies.map((d) =>
            d.id === data.dependency.id
              ? { ...d, lag: data.dependency.lag }
              : d
          );

          // Apply cascaded updates
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
                return { ...td, startDate: new Date(update.startDate), endDate: new Date(update.endDate), duration: update.duration, offset: update.offset };
              }
              return td;
            });
          }

          return { ...old, dependencies: newDeps, milestones: newMilestones, teamDurations: newTeamDurations };
        }
      );
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
export function useTeams() {
  return useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const response = await fetch("/api/teams");
      if (!response.ok) {
        throw new Error("Failed to fetch teams");
      }
      return response.json() as Promise<{ teams: Team[] }>;
    },
  });
}

export function useCreateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; color?: string }) => {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export function useUpdateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { id: string; name?: string; color?: string; autoAdd?: boolean }) => {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export function useDeleteTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch("/api/teams", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete team");
      }
      return { id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
    },
  });
}

export function useReorderTeams() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderedTeamIds: string[]) => {
      const response = await fetch("/api/teams/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedTeamIds }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to reorder teams");
      }
      return response.json();
    },
    onMutate: async (orderedTeamIds) => {
      await queryClient.cancelQueries({ queryKey: ["teams"] });
      const prev = queryClient.getQueryData<{ teams: Team[] }>(["teams"]);

      if (prev) {
        const teamMap = new Map(prev.teams.map((t) => [t.id, t]));
        const reordered = orderedTeamIds
          .map((id, i) => {
            const team = teamMap.get(id);
            return team ? { ...team, sortOrder: i } : null;
          })
          .filter(Boolean) as Team[];
        // Append any teams not in the ordered list
        const orderedSet = new Set(orderedTeamIds);
        const rest = prev.teams.filter((t) => !orderedSet.has(t.id));
        queryClient.setQueryData(["teams"], { teams: [...reordered, ...rest] });
      }

      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(["teams"], context.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

// Team duration hooks
interface TeamDurationUpsertResponse {
  teamDuration: TeamMilestoneDuration;
  cascadedUpdates?: CascadedUpdate[];
  teamCascadedUpdates: TeamCascadedUpdate[];
}

export function useUpsertTeamDuration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      milestoneId: string;
      teamId: string;
      duration: number;
      startDate?: string;
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

          // Apply team cascaded updates
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
                  offset: update.offset,
                };
              }
              return d;
            });
          }

          // Apply milestone cascaded updates (parent expansion + dependency cascade)
          let newMilestones = old.milestones;
          if (data.cascadedUpdates?.length) {
            const msUpdateMap = new Map(
              data.cascadedUpdates.map((u) => [u.id, u])
            );
            newMilestones = newMilestones.map((m) => {
              const update = msUpdateMap.get(m.id);
              if (update) {
                return {
                  ...m,
                  startDate: new Date(update.startDate),
                  endDate: new Date(update.endDate),
                  ...(update.duration !== undefined ? { duration: update.duration } : {}),
                };
              }
              return m;
            });
          }

          return { ...old, milestones: newMilestones, teamDurations };
        }
      );
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
    },
  });
}

interface TeamDurationDeleteResponse {
  success: boolean;
  cascadedUpdates?: CascadedUpdate[];
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
                return { ...d, startDate: new Date(update.startDate), endDate: new Date(update.endDate), duration: update.duration, offset: update.offset };
              }
              return d;
            });
          }

          // Apply milestone cascaded updates
          let newMilestones = old.milestones;
          if (data.cascadedUpdates?.length) {
            const msUpdateMap = new Map(
              data.cascadedUpdates.map((u) => [u.id, u])
            );
            newMilestones = newMilestones.map((m) => {
              const update = msUpdateMap.get(m.id);
              if (update) {
                return {
                  ...m,
                  startDate: new Date(update.startDate),
                  endDate: new Date(update.endDate),
                  ...(update.duration !== undefined ? { duration: update.duration } : {}),
                };
              }
              return m;
            });
          }

          return { ...old, milestones: newMilestones, teamDurations };
        }
      );
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
    },
  });
}

interface TightenGapsResponse {
  cascadedUpdates: CascadedUpdate[];
  teamCascadedUpdates?: TeamCascadedUpdate[];
  count: number;
}

export function useTightenGaps() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string) => {
      const response = await fetch("/api/projects/tighten-gaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to tighten gaps");
      }
      return response.json() as Promise<TightenGapsResponse>;
    },
    onSuccess: (data) => {
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
                  ...(update.duration !== undefined
                    ? { duration: update.duration }
                    : {}),
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
                const update = teamUpdateMap.get(
                  `${td.milestoneId}__${td.teamId}`
                );
                if (update) {
                  return {
                    ...td,
                    startDate: new Date(update.startDate),
                    endDate: new Date(update.endDate),
                    duration: update.duration,
                    offset: update.offset,
                  };
                }
                return td;
              });
            }

            return {
              ...old,
              milestones: newMilestones,
              teamDurations: newTeamDurations,
            };
          }
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
    },
  });
}
