import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MagneticOrc } from "@/components/magnetic-orc";
import { ArrowRight } from "lucide-react";

export default async function HomePage() {
  const { userId } = await auth();

  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-background px-6">
      {/* Dot grid background texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `radial-gradient(var(--foreground) 1px, transparent 1px)`,
          backgroundSize: "20px 20px",
        }}
      />

      {/* Soft radial glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.03] blur-[120px]" />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-12">
        {/* Logo + Brand */}
        <div className="flex flex-col items-center gap-6">
          {/* Orc emblem — magnetic to cursor */}
          <MagneticOrc />

          <div className="flex flex-col items-center gap-2">
            <h1
              className="text-4xl font-normal tracking-wide text-foreground uppercase sm:text-5xl"
              style={{ fontFamily: "Silkscreen, cursive" }}
            >
              Shronk
            </h1>
            <p
              className="text-xs tracking-[0.2em] uppercase text-muted-foreground"
              style={{ fontFamily: "Silkscreen, cursive" }}
            >
              Milestone Tracker
            </p>
          </div>
        </div>

        {/* CTAs */}
        <div className="flex w-full max-w-[280px] flex-col gap-3">
          <Button
            size="lg"
            className="group h-12 gap-2 text-[15px] font-semibold"
            asChild
          >
            <Link href="/sign-up">
              Get Started
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="ghost"
            className="h-12 text-[15px] text-muted-foreground"
            asChild
          >
            <Link href="/sign-in">Sign In</Link>
          </Button>
        </div>
      </div>

      {/* Decorative footer */}
      <div className="absolute bottom-6 flex items-center gap-2.5 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/40">
        <div className="h-px w-6 bg-border" />
        track &middot; plan &middot; ship
        <div className="h-px w-6 bg-border" />
      </div>
    </div>
  );
}
