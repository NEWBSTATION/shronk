"use client";

import { useState, useMemo, useRef } from "react";
import { toast } from "sonner";
import {
  useMembers,
  useUpdateMemberRole,
  useRemoveMember,
  useInvites,
  useCreateInvite,
  useRevokeInvite,
  useResendInvite,
} from "@/hooks/use-members";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
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
import { Loader2, Plus, X, Mail, Clock, ShieldCheck, Trash2, Check, Search, RotateCw } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { formatDistanceToNow } from "date-fns";
import { getColorStyles } from "@/lib/milestone-theme";

const HEADER_STYLES = getColorStyles("slate");

function MemberRow({
  member,
  isCurrentUser,
  onRoleChange,
  onRemove,
}: {
  member: { id: string; userId: string; name: string; email: string; role: string; imageUrl: string | null };
  isCurrentUser: boolean;
  onRoleChange: (id: string, role: "admin" | "member") => void;
  onRemove: (id: string, name: string) => void;
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
            {isCurrentUser && (
              <span className="ml-1.5 text-muted-foreground font-normal">(you)</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground truncate">{member.email}</p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isCurrentUser ? (
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
                <SelectTrigger className="h-7 w-[90px] text-xs border-0 bg-transparent shadow-none opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                </SelectContent>
              </Select>
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

export function MembersTab() {
  const { user } = useUser();
  const { data: membersData, isLoading: membersLoading } = useMembers();
  const { data: invitesData } = useInvites();
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();
  const createInvite = useCreateInvite();
  const revokeInvite = useRevokeInvite();
  const resendInvite = useResendInvite();

  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("admin");
  const [removeTarget, setRemoveTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const members = membersData?.members || [];
  const pendingInvites = invitesData?.invites || [];

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
    );
  }, [members, searchQuery]);

  const filteredInvites = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return pendingInvites;
    return pendingInvites.filter((inv) =>
      inv.email.toLowerCase().includes(q)
    );
  }, [pendingInvites, searchQuery]);

  const handleInvite = () => {
    if (!inviteEmail.trim()) return;

    createInvite.mutate(
      { email: inviteEmail.trim(), role: inviteRole },
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
    removeMember.mutate(id, {
      onSuccess: () => {
        toast.success("Member removed");
        setRemoveTarget(null);
      },
      onError: (error) => {
        toast.error(error.message);
        setRemoveTarget(null);
      },
    });
  };

  const handleRevoke = (id: string) => {
    revokeInvite.mutate(id, {
      onSuccess: () => toast.success("Invite revoked"),
      onError: (error) => toast.error(error.message),
    });
  };

  const handleResend = (id: string) => {
    resendInvite.mutate(id, {
      onSuccess: () => toast.success("Invite resent"),
      onError: (error) => toast.error(error.message),
    });
  };

  if (membersLoading) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b last:border-b-0">
              <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
              <div className="h-4 w-32 rounded bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search input */}
      {(members.length > 0 || pendingInvites.length > 0) && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
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

      {searchQuery && filteredMembers.length === 0 && filteredInvites.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            No members matching &quot;{searchQuery.trim()}&quot;
          </p>
        </div>
      ) : (
      <>
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
            onRoleChange={handleRoleChange}
            onRemove={(id, name) => setRemoveTarget({ id, name })}
          />
        ))}

        {/* Pending invites — inline in the same card */}
        {filteredInvites.map((invite) => (
          <InviteRow
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
          <div className="flex items-center gap-3 px-4 py-3.5 border-t bg-background">
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
            className="w-full px-4 py-3.5 flex items-center gap-3 text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors cursor-pointer border-t"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center">
              <Plus className="h-4 w-4" />
            </div>
            <span className="text-sm">Invite a member</span>
          </button>
        )}
      </div>
      </>
      )}

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
    </div>
  );
}
