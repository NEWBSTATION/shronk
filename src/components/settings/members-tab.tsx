"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  useMembers,
  useUpdateMemberRole,
  useRemoveMember,
  useInvites,
  useCreateInvite,
  useRevokeInvite,
} from "@/hooks/use-members";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Loader2, Plus, X, Mail, Clock } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { formatDistanceToNow } from "date-fns";

export function MembersTab() {
  const { user } = useUser();
  const { data: membersData, isLoading: membersLoading } = useMembers();
  const { data: invitesData, isLoading: invitesLoading } = useInvites();
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();
  const createInvite = useCreateInvite();
  const revokeInvite = useRevokeInvite();

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("admin");
  const [removeTarget, setRemoveTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const members = membersData?.members || [];
  const pendingInvites = invitesData?.invites || [];

  const handleInvite = () => {
    if (!inviteEmail.trim()) return;

    createInvite.mutate(
      { email: inviteEmail.trim(), role: inviteRole },
      {
        onSuccess: () => {
          toast.success(`Invite sent to ${inviteEmail}`);
          setInviteEmail("");
          setInviteRole("admin");
          setInviteDialogOpen(false);
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

  if (membersLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Members Section */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Members ({members.length})
          </h3>
          <Button
            size="sm"
            onClick={() => setInviteDialogOpen(true)}
          >
            <Plus className="mr-1.5 size-3.5" />
            Invite
          </Button>
        </div>
        <div className="rounded-lg border">
          {members.map((member, i) => {
            const isCurrentUser = member.userId === user?.id;
            const initials = member.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);

            return (
              <div
                key={member.id}
                className={`flex items-center gap-3 px-4 py-3${
                  i < members.length - 1 ? " border-b" : ""
                }`}
              >
                <Avatar className="size-8 shrink-0">
                  <AvatarImage src={member.imageUrl || undefined} alt={member.name} />
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {member.name}
                    {isCurrentUser && (
                      <span className="ml-1.5 text-muted-foreground font-normal">
                        (you)
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {member.email}
                  </p>
                </div>
                {isCurrentUser ? (
                  <Badge variant="secondary" className="shrink-0 capitalize">
                    {member.role}
                  </Badge>
                ) : (
                  <div className="flex items-center gap-2 shrink-0">
                    <Select
                      value={member.role}
                      onValueChange={(value) =>
                        handleRoleChange(member.id, value as "admin" | "member")
                      }
                    >
                      <SelectTrigger className="h-8 w-[100px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() =>
                        setRemoveTarget({ id: member.id, name: member.name })
                      }
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pending Invites Section */}
      {pendingInvites.length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Pending Invites ({pendingInvites.length})
          </h3>
          <div className="rounded-lg border">
            {pendingInvites.map((invite, i) => (
              <div
                key={invite.id}
                className={`flex items-center gap-3 px-4 py-3${
                  i < pendingInvites.length - 1 ? " border-b" : ""
                }`}
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Mail className="size-3.5 text-muted-foreground" />
                </div>
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
                <Badge variant="outline" className="shrink-0 capitalize">
                  {invite.role}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => handleRevoke(invite.id)}
                  disabled={revokeInvite.isPending}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label htmlFor="invite-email" className="text-sm font-medium">
                Email address
              </label>
              <Input
                id="invite-email"
                type="email"
                placeholder="name@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleInvite();
                }}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="invite-role" className="text-sm font-medium">
                Role
              </label>
              <Select
                value={inviteRole}
                onValueChange={(v) => setInviteRole(v as "admin" | "member")}
              >
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setInviteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              disabled={!inviteEmail.trim() || createInvite.isPending}
            >
              {createInvite.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation */}
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
