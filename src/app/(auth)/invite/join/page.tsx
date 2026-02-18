"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useAcceptInviteLink } from "@/hooks/use-members";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

function JoinContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const acceptLink = useAcceptInviteLink();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const token = searchParams.get("token");

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      const returnUrl = `/invite/join?token=${token}`;
      router.push(`/sign-in?redirect_url=${encodeURIComponent(returnUrl)}`);
      return;
    }

    if (!token) {
      setStatus("error");
      setErrorMessage("No invite token provided");
      return;
    }

    acceptLink.mutate(token, {
      onSuccess: () => {
        setStatus("success");
        setTimeout(() => router.push("/dashboard"), 2000);
      },
      onError: (error) => {
        setStatus("error");
        setErrorMessage(error.message);
      },
    });
  }, [isLoaded, isSignedIn, token]);

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="mx-auto w-full max-w-sm space-y-4 text-center">
        {status === "loading" && (
          <>
            <Loader2 className="mx-auto size-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Joining workspace...</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 className="mx-auto size-8 text-green-500" />
            <p className="font-medium">You&apos;ve joined the workspace!</p>
            <p className="text-sm text-muted-foreground">
              Redirecting to dashboard...
            </p>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="mx-auto size-8 text-destructive" />
            <p className="font-medium">Could not join workspace</p>
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
            <Button variant="outline" onClick={() => router.push("/dashboard")}>
              Go to Dashboard
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <JoinContent />
    </Suspense>
  );
}
