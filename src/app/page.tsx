import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Target } from "lucide-react";

export default async function HomePage() {
  const { userId } = await auth();

  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <div className="flex items-center gap-2">
          <Target className="h-6 w-6" />
          <span className="text-xl font-bold">Shronk</span>
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">
            Milestone Tracking,{" "}
            <span className="text-primary">Simplified</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Organize projects, set milestones, and track progress towards your
            goals.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2">
          <Button size="lg" asChild>
            <Link href="/sign-up">Get Started</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/sign-in">Sign In</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
