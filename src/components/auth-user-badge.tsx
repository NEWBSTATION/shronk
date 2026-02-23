"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useWorkspaces } from "@/hooks/use-workspaces";

export function AuthUserBadge() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();

  if (!isLoaded || !user) return null;

  const displayName =
    (user.unsafeMetadata?.displayName as string | undefined) ||
    user.fullName ||
    user.firstName ||
    user.primaryEmailAddress?.emailAddress ||
    "User";

  const email = user.primaryEmailAddress?.emailAddress || "";

  const initials =
    user.firstName && user.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`
      : user.firstName?.[0] ||
        user.emailAddresses[0]?.emailAddress[0]?.toUpperCase() ||
        "U";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-accent transition-colors">
          <Avatar className="h-7 w-7 rounded-full">
            {user.hasImage && (
              <AvatarImage src={user.imageUrl} alt={displayName} />
            )}
            <AvatarFallback className="rounded-full text-[10px]">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1">
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar className="h-8 w-8 rounded-full shrink-0">
            {user.hasImage && (
              <AvatarImage src={user.imageUrl} alt={displayName} />
            )}
            <AvatarFallback className="rounded-full text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="grid flex-1 leading-tight min-w-0">
            <span className="truncate text-sm font-medium">{displayName}</span>
            {email && (
              <span className="truncate text-xs text-muted-foreground">
                {email}
              </span>
            )}
          </div>
        </div>
        <div className="h-px bg-border my-1" />
        <button
          onClick={() => signOut({ redirectUrl: "/" })}
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </PopoverContent>
    </Popover>
  );
}

export function AuthBackToLanding() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const pathname = usePathname();
  const { data: workspacesData } = useWorkspaces();

  // On workspace-create, go back to dashboard if user has workspaces, otherwise workspace-select
  if (pathname === "/workspace-create") {
    const hasWorkspaces = (workspacesData?.workspaces?.length ?? 0) > 0;
    return (
      <Link
        href={hasWorkspaces ? "/dashboard" : "/workspace-select"}
        className="flex items-center gap-1.5 text-sm text-muted-foreground/60 transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>
    );
  }

  const handleClick = () => {
    if (isLoaded && user) {
      signOut({ redirectUrl: "/" });
    } else {
      window.location.href = "/";
    }
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-1.5 text-sm text-muted-foreground/60 transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      Shronk
    </button>
  );
}
