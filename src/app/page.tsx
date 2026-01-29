import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Target, ArrowRight } from "lucide-react";

export default async function HomePage() {
  const { userId } = await auth();

  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Target className="h-6 w-6" />
            <span className="text-xl font-bold">Shronk</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link href="/sign-in">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/sign-up">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="container flex flex-col items-center justify-center gap-8 px-4 py-24 text-center md:py-32">
          <div className="flex items-center gap-2 rounded-full border bg-muted px-4 py-1.5 text-sm">
            <span>Powered by tweakcn themes</span>
          </div>

          <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
            Track Your Project{" "}
            <span className="text-primary">Milestones</span> with Ease
          </h1>

          <p className="max-w-xl text-lg text-muted-foreground">
            Shronk is a simple, beautiful milestone tracking app. Organize your
            projects, set milestones, and track your progress towards your goals.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/sign-up">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/sign-in">Sign In</Link>
            </Button>
          </div>
        </section>

        <section className="border-t bg-muted/50">
          <div className="container grid gap-8 px-4 py-16 md:grid-cols-3">
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-semibold">Project Organization</h3>
              <p className="text-sm text-muted-foreground">
                Group related milestones into projects for better organization
                and tracking.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-semibold">Progress Tracking</h3>
              <p className="text-sm text-muted-foreground">
                Track milestone status with pending, in-progress, and completed
                states.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-semibold">Beautiful Themes</h3>
              <p className="text-sm text-muted-foreground">
                Customize your experience with tweakcn-powered themes. Light and
                dark modes included.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="container flex h-16 items-center justify-between px-4 text-sm text-muted-foreground">
          <p>Built with tweakcn theming</p>
          <a
            href="https://tweakcn.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            tweakcn.com
          </a>
        </div>
      </footer>
    </div>
  );
}
