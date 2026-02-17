"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Member, Invite } from "@/db/schema";

interface MemberWithInfo extends Member {
  name: string;
  imageUrl: string | null;
}

interface MembersResponse {
  members: MemberWithInfo[];
  currentUserRole: "admin" | "member" | null;
}

interface InvitesResponse {
  invites: Invite[];
}

export function useMembers() {
  return useQuery<MembersResponse>({
    queryKey: ["members"],
    queryFn: async () => {
      const res = await fetch("/api/members");
      if (!res.ok) throw new Error("Failed to fetch members");
      return res.json();
    },
  });
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: "admin" | "member" }) => {
      const res = await fetch(`/api/members/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update role");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/members/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove member");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
  });
}

export function useInvites() {
  return useQuery<InvitesResponse>({
    queryKey: ["invites"],
    queryFn: async () => {
      const res = await fetch("/api/invites");
      if (!res.ok) throw new Error("Failed to fetch invites");
      return res.json();
    },
  });
}

export function useCreateInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ email, role }: { email: string; role: "admin" | "member" }) => {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send invite");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invites"] });
    },
  });
}

export function useResendInvite() {
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/invites/${id}`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to resend invite");
      }
      return res.json();
    },
  });
}

export function useRevokeInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/invites/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to revoke invite");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invites"] });
    },
  });
}

export function useAcceptInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (token: string) => {
      const res = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to accept invite");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
  });
}
