"use client";

import { useState, useMemo, useRef } from "react";
import { toast } from "sonner";
import {
  useMembers,
  useUpdateMemberRole,
  useRemoveMember,
  useLeaveWorkspace,
  useInvites,
  useCreateInvite,
  useRevokeInvite,
  useResendInvite,
  useInviteLink,
  useCreateInviteLink,
  useUpdateInviteLinkRole,
  useTransferOwnership,
} from "@/hooks/use-members";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Plus, X, Mail, Clock, ShieldCheck, Trash2, Check, Search, RotateCw, Link2, Copy, RefreshCw, LogOut, Crown, XCircle } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { formatDistanceToNow } from "date-fns";
import { getColorStyles } from "@/lib/milestone-theme";

const HEADER_STYLES = getColorStyles("slate");

function MemberRow({
  member,
  isCurrentUser,
  isOwner,
  currentUserIsOwner,
  onRoleChange,
  onRemove,
  onTransferOwnership,
}: {
  member: { id: string; userId: string; name: string; email: string; role: string; imageUrl: string | null };
  isCurrentUser: boolean;
  isOwner: boolean;
  currentUserIsOwner: boolean;
  onRoleChange: (id: string, role: "admin" | "member") => void;
  onRemove: (id: string, name: string) => void;
  onTransferOwnership: (userId: string, name: string) => void;
}) {
  const initials = member.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex items-center px-4 py-3.5 transition-colors group bg-background hover:bg-accent/50 border-b last:border-b-0">
      <Avatar className="size-8 shrink-0">
        <AvatarImage src={member.imageUrl || undefined} alt={member.name} />
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>

      <div className="flex flex-1 ml-3 min-w-0 items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">
            {member.name}
            {isOwner && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 text-[11px] text-amber-500 font-medium">
                <Crown className="size-3" />
                Owner
              </span>
            )}
            {isCurrentUser && (
              <span className="ml-1.5 text-muted-foreground font-normal">(you)</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground truncate">{member.email}</p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isCurrentUser || isOwner ? (
            <span className="text-xs text-muted-foreground capitalize px-1">
              {member.role}
            </span>
          ) : (
            <>
              <Select
                value={member.role}
                onValueChange={(value) =>
                  onRoleChange(member.id, value as "admin" | "member")
                }
              >
                <SelectTrigger className="h-7 w-auto text-xs border-0 bg-transparent shadow-none opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                </SelectContent>
              </Select>
              {currentUserIsOwner && (
                <button
                  onClick={() => onTransferOwnership(member.userId, member.name)}
                  className="shrink-0 h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-amber-500/10 hover:text-amber-500 transition-all"
                  title="Transfer ownership"
                >
                  <Crown className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => onRemove(member.id, member.name)}
                className="shrink-0 h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                title="Remove member"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function InviteRow({
  invite,
  onRevoke,
  onResend,
  isRevoking,
  isResending,
}: {
  invite: { id: string; email: string; role: string; createdAt: Date | string };
  onRevoke: (id: string) => void;
  onResend: (id: string) => void;
  isRevoking: boolean;
  isResending: boolean;
}) {
  return (
    <div className="flex items-center px-4 py-3.5 transition-colors group bg-background hover:bg-accent/50 border-b last:border-b-0">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
        <Mail className="size-3.5 text-muted-foreground" />
      </div>

      <div className="flex flex-1 ml-3 min-w-0 items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{invite.email}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" />
            Sent{" "}
            {formatDistanceToNow(new Date(invite.createdAt), {
              addSuffix: true,
            })}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-xs text-muted-foreground capitalize px-1">
            {invite.role}
          </span>
          <button
            onClick={() => onResend(invite.id)}
            disabled={isResending}
            className="shrink-0 h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-all disabled:opacity-50"
            title="Resend invite"
          >
            {isResending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RotateCw className="size-3.5" />
            )}
          </button>
          <button
            onClick={() => onRevoke(invite.id)}
            disabled={isRevoking}
            className="shrink-0 h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
            title="Revoke invite"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function DeclinedInviteRow({
  invite,
  onRevoke,
  onResend,
  isRevoking,
  isResending,
}: {
  invite: { id: string; email: string; role: string; declinedAt: Date | string | null };
  onRevoke: (id: string) => void;
  onResend: (id: string) => void;
  isRevoking: boolean;
  isResending: boolean;
}) {
  return (
    <div className="flex items-center px-4 py-3.5 transition-colors group bg-background hover:bg-accent/50 border-b last:border-b-0">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-destructive/10">
        <XCircle className="size-3.5 text-destructive" />
      </div>

      <div className="flex flex-1 ml-3 min-w-0 items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{invite.email}</p>
          <p className="flex items-center gap-1 text-xs text-destructive/70">
            <Clock className="size-3" />
            Declined{" "}
            {invite.declinedAt
              ? formatDistanceToNow(new Date(invite.declinedAt), {
                  addSuffix: true,
                })
              : "recently"}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-xs text-muted-foreground capitalize px-1">
            {invite.role}
          </span>
          <button
            onClick={() => onResend(invite.id)}
            disabled={isResending}
            className="shrink-0 h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-all disabled:opacity-50"
            title="Resend invite"
          >
            {isResending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RotateCw className="size-3.5" />
            )}
          </button>
          <button
            onClick={() => onRevoke(invite.id)}
            disabled={isRevoking}
            className="shrink-0 h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
            title="Remove invite"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function InviteLinkSection() {
  const { data, isLoading } = useInviteLink();
  const createLink = useCreateInviteLink();
  const updateRole = useUpdateInviteLinkRole();
  const [copied, setCopied] = useState(false);

  const inviteLink = data?.inviteLink ?? null;

  const linkUrl = inviteLink
    ? `${window.location.origin}/invite/join?token=${inviteLink.token}`
    : "";

  const handleCopy = async () => {
    if (!linkUrl) return;
    try {
      await navigator.clipboard.writeText(linkUrl);
    } catch {
      // Fallback for non-secure contexts (HTTP / LAN)
      const ta = document.createElement("textarea");
      ta.value = linkUrl;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    toast.success("Invite link copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    createLink.mutate(inviteLink?.role ?? "member", {
      onSuccess: () => toast.success("Link reset — old link no longer works"),
      onError: (error) => toast.error(error.message),
    });
  };

  const handleRoleChange = (role: "admin" | "member") => {
    updateRole.mutate(role, {
      onError: (error) => toast.error(error.message),
    });
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center h-9 rounded-lg border bg-background overflow-hidden">
        {/* Link icon */}
        <div className="shrink-0 flex items-center justify-center w-9 h-full text-muted-foreground border-r">
          <Link2 className="size-3.5" />
        </div>

        {/* URL text — takes remaining space */}
        {isLoading ? (
          <div className="flex-1 px-3 py-2">
            <div className="h-3.5 w-48 rounded bg-muted animate-pulse" />
          </div>
        ) : (
          <div
            className="flex-1 min-w-0 px-3 text-xs text-muted-foreground truncate select-all cursor-text font-mono leading-9"
            onClick={(e) => {
              // Select all text on click
              const range = document.createRange();
              range.selectNodeContents(e.currentTarget);
              const sel = window.getSelection();
              sel?.removeAllRanges();
              sel?.addRange(range);
            }}
          >
            {linkUrl}
          </div>
        )}

        {/* Role selector — compact inline dropdown */}
        <Select
          value={inviteLink?.role ?? "member"}
          onValueChange={(v) => handleRoleChange(v as "admin" | "member")}
          disabled={isLoading}
        >
          <SelectTrigger className="shrink-0 h-full w-auto gap-1 rounded-none border-0 border-l shadow-none text-xs px-2.5 focus:ring-0 focus:ring-offset-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="member">Member</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>

        {/* Reset button */}
        <button
          onClick={handleReset}
          disabled={createLink.isPending || isLoading}
          className="shrink-0 flex items-center justify-center w-9 h-full border-l text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors disabled:opacity-50"
          title="Reset link"
        >
          {createLink.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
        </button>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          disabled={isLoading}
          className="shrink-0 flex items-center justify-center w-9 h-full border-l text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors disabled:opacity-50"
          title="Copy invite link"
        >
          {copied ? (
            <Check className="size-3.5 text-green-500" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </button>
      </div>

      {/* Expiry hint */}
      {inviteLink && (
        <p className="text-[11px] text-muted-foreground/60 px-1">
          Expires{" "}
          {formatDistanceToNow(new Date(inviteLink.expiresAt), {
            addSuffix: true,
          })}
          {" · "}
          Reset to generate a new link
        </p>
      )}
    </div>
  );
}

export function MembersTab() {
  const { user } = useUser();
  const { data: membersData, isLoading: membersLoading } = useMembers();
  const { data: invitesData } = useInvites();
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();
  const leaveWorkspace = useLeaveWorkspace();
  const createInvite = useCreateInvite();
  const revokeInvite = useRevokeInvite();
  const resendInvite = useResendInvite();
  const transferOwnership = useTransferOwnership();
  const { workspaceId } = useWorkspace();

  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("admin");
  const [removeTarget, setRemoveTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [transferTarget, setTransferTarget] = useState<{
    userId: string;
    name: string;
  } | null>(null);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [transferToUserId, setTransferToUserId] = useState<string>("");

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const members = membersData?.members || [];
  const ownerId = membersData?.ownerId;
  const isCurrentUserOwner = ownerId === user?.id;
  const allInvites = invitesData?.invites || [];
  const pendingInvites = allInvites.filter((inv) => inv.status === "pending");
  const declinedInvites = allInvites.filter((inv) => inv.status === "declined");

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
    );
  }, [members, searchQuery]);

  const filteredPendingInvites = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return pendingInvites;
    return pendingInvites.filter((inv) =>
      inv.email.toLowerCase().includes(q)
    );
  }, [pendingInvites, searchQuery]);

  const filteredDeclinedInvites = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return declinedInvites;
    return declinedInvites.filter((inv) =>
      inv.email.toLowerCase().includes(q)
    );
  }, [declinedInvites, searchQuery]);

  const handleInvite = () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;

    // Check if email is already a member
    if (members.some((m) => m.email.toLowerCase() === email)) {
      toast.error("This email is already a member of this workspace");
      return;
    }

    // Check if email has a pending invite
    if (pendingInvites.some((inv) => inv.email.toLowerCase() === email)) {
      toast.error("A pending invite already exists for this email");
      return;
    }

    createInvite.mutate(
      { email, role: inviteRole },
      {
        onSuccess: () => {
          toast.success(`Invite sent to ${inviteEmail}`);
          setInviteEmail("");
          setInviteRole("admin");
          setShowInviteForm(false);
        },
        onError: (error) => {
          toast.error(error.message);
        },
      }
    );
  };

  const handleRoleChange = (memberId: string, newRole: "admin" | "member") => {
    updateRole.mutate(
      { id: memberId, role: newRole },
      {
        onSuccess: () => toast.success("Role updated"),
        onError: (error) => toast.error(error.message),
      }
    );
  };

  const handleRemove = (id: string) => {
    const name = removeTarget?.name;
    removeMember.mutate(id, {
      onSuccess: () => {
        toast.success("Member removed", { description: name ?? undefined });
        setRemoveTarget(null);
      },
      onError: (error) => {
        toast.error(error.message);
        setRemoveTarget(null);
      },
    });
  };

  const handleRevoke = (id: string) => {
    const invite = allInvites.find((inv) => inv.id === id);
    revokeInvite.mutate(id, {
      onSuccess: () => toast.success("Invite revoked", { description: invite?.email }),
      onError: (error) => toast.error(error.message),
    });
  };

  const handleResend = (id: string) => {
    const invite = allInvites.find((inv) => inv.id === id);
    resendInvite.mutate(id, {
      onSuccess: () => toast.success("Invite resent", { description: invite?.email }),
      onError: (error) => toast.error(error.message),
    });
  };

  if (membersLoading) {
    return (
      <div className="space-y-4">
        {/* Search bar */}
        <Skeleton className="h-9 w-full rounded-md" />

        {/* Invite link card */}
        <div className="rounded-2xl overflow-hidden border px-4 py-3 space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>

        {/* Members card */}
        <div className="rounded-2xl overflow-hidden border">
          {/* Header */}
          <div className="px-4 py-3 border-b">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-6 rounded-full" />
            </div>
          </div>

          {/* Member rows */}
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center px-4 py-3.5 border-b last:border-b-0 gap-3">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-44" />
              </div>
              <Skeleton className="h-4 w-12" />
            </div>
          ))}

          {/* Invite button row */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-t">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search input */}
      {(members.length > 0 || allInvites.length > 0) && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9 bg-transparent dark:bg-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                searchInputRef.current?.focus();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {searchQuery && filteredMembers.length === 0 && filteredPendingInvites.length === 0 && filteredDeclinedInvites.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            No members matching &quot;{searchQuery.trim()}&quot;
          </p>
        </div>
      ) : (
      <>
      {/* Invite link */}
      <div className="rounded-2xl overflow-hidden border px-4 py-3 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Invite link</p>
        <InviteLinkSection />
      </div>

      {/* Members card */}
      <div className="rounded-2xl overflow-hidden border">
        {/* Header — mirrors teams tab */}
        <div className="w-full text-left group relative overflow-hidden px-4 py-3 rounded-t-2xl border-b">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(to right, transparent 30%, ${HEADER_STYLES.gradient} 100%)`,
            }}
          />
          <div className="relative flex items-center gap-3">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: HEADER_STYLES.iconBg, color: HEADER_STYLES.hex }}
            >
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="flex flex-1 items-center gap-2 min-w-0">
              <span className="text-sm font-medium truncate">Members</span>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {filteredMembers.length}
              </span>
            </div>

            <button
              onClick={() => setShowInviteForm(true)}
              className="shrink-0 h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-accent/50 transition-all"
              title="Invite member"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Member rows */}
        {filteredMembers.map((member) => (
          <MemberRow
            key={member.id}
            member={member}
            isCurrentUser={member.userId === user?.id}
            isOwner={member.userId === ownerId}
            currentUserIsOwner={isCurrentUserOwner}
            onRoleChange={handleRoleChange}
            onRemove={(id, name) => setRemoveTarget({ id, name })}
            onTransferOwnership={(userId, name) => setTransferTarget({ userId, name })}
          />
        ))}

        {/* Pending invites — inline in the same card */}
        {filteredPendingInvites.map((invite) => (
          <InviteRow
            key={invite.id}
            invite={invite}
            onRevoke={handleRevoke}
            onResend={handleResend}
            isRevoking={revokeInvite.isPending}
            isResending={resendInvite.isPending}
          />
        ))}

        {/* Declined invites */}
        {filteredDeclinedInvites.length > 0 && (
          <div className="px-4 py-2 border-b">
            <span className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">Declined</span>
          </div>
        )}
        {filteredDeclinedInvites.map((invite) => (
          <DeclinedInviteRow
            key={invite.id}
            invite={invite}
            onRevoke={handleRevoke}
            onResend={handleResend}
            isRevoking={revokeInvite.isPending}
            isResending={resendInvite.isPending}
          />
        ))}

        {/* Invite form — inline at bottom like teams add form */}
        {showInviteForm ? (
          <div className="flex items-center gap-3 px-4 py-3.5 bg-background">
            <Input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              type="email"
              placeholder="name@example.com"
              className="h-8 flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleInvite();
                if (e.key === "Escape") {
                  setShowInviteForm(false);
                  setInviteEmail("");
                }
              }}
              autoFocus
            />
            <Select
              value={inviteRole}
              onValueChange={(v) => setInviteRole(v as "admin" | "member")}
            >
              <SelectTrigger className="h-8 w-[90px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="member">Member</SelectItem>
              </SelectContent>
            </Select>
            <button
              onClick={handleInvite}
              disabled={!inviteEmail.trim() || createInvite.isPending}
              className="shrink-0 h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all disabled:opacity-50"
            >
              {createInvite.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              onClick={() => {
                setShowInviteForm(false);
                setInviteEmail("");
              }}
              className="shrink-0 h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowInviteForm(true)}
            className="w-full px-4 py-3.5 flex items-center gap-3 text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors cursor-pointer"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center">
              <Plus className="h-4 w-4" />
            </div>
            <span className="text-sm">Invite a member</span>
          </button>
        )}
      </div>

      {/* Danger zone */}
      <div className="rounded-2xl overflow-hidden border border-destructive/20">
        <div className="px-4 py-3 border-b border-destructive/20 bg-destructive/5">
          <p className="text-xs font-medium text-destructive">Danger zone</p>
        </div>
        <div className="px-4 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">Leave this workspace</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isCurrentUserOwner
                ? "You must transfer ownership to another member before leaving."
                : "You\u2019ll lose access to all projects and data in this workspace immediately."}
            </p>
          </div>
          <button
            onClick={() => {
              setTransferToUserId("");
              setShowLeaveDialog(true);
            }}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-sm font-medium border border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
          >
            <LogOut className="size-3.5" />
            Leave
          </button>
        </div>
      </div>
      </>
      )}

      {/* Leave workspace confirmation */}
      <AlertDialog
        open={showLeaveDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowLeaveDialog(false);
            setTransferToUserId("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave workspace</AlertDialogTitle>
            <AlertDialogDescription>
              {isCurrentUserOwner
                ? "You must transfer ownership before leaving. Select a member to become the new owner."
                : "Are you sure you want to leave this workspace? You\u2019ll lose access immediately."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {isCurrentUserOwner && (
            <div className="py-1">
              <Select
                value={transferToUserId}
                onValueChange={setTransferToUserId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select new owner..." />
                </SelectTrigger>
                <SelectContent>
                  {members
                    .filter((m) => m.userId !== user?.id)
                    .map((m) => (
                      <SelectItem key={m.userId} value={m.userId}>
                        {m.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isCurrentUserOwner && !transferToUserId}
              onClick={() => {
                leaveWorkspace.mutate(
                  isCurrentUserOwner ? transferToUserId : undefined,
                  {
                    onSuccess: () => {
                      window.location.href = "/dashboard";
                    },
                    onError: (error) => {
                      toast.error(error.message);
                      setShowLeaveDialog(false);
                    },
                  }
                );
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {leaveWorkspace.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              {isCurrentUserOwner ? "Transfer & leave" : "Leave"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove confirmation */}
      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {removeTarget?.name}? They will
              lose access immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeTarget && handleRemove(removeTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeMember.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Transfer ownership confirmation */}
      <AlertDialog
        open={!!transferTarget}
        onOpenChange={(open) => !open && setTransferTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transfer ownership</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to make {transferTarget?.name} the owner of
              this workspace? You will remain as an admin but will no longer be
              the owner.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!transferTarget) return;
                transferOwnership.mutate(
                  { workspaceId, newOwnerId: transferTarget.userId },
                  {
                    onSuccess: () => {
                      toast.success("Ownership transferred", {
                        description: `${transferTarget.name} is now the workspace owner`,
                      });
                      setTransferTarget(null);
                    },
                    onError: (error) => {
                      toast.error(error.message);
                      setTransferTarget(null);
                    },
                  }
                );
              }}
            >
              {transferOwnership.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Transfer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
