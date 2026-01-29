import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { FolderKanban, Target, CheckCircle2, Clock } from "lucide-react";

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Placeholder stats - these will be replaced with real data
  const stats = [
    {
      title: "Total Projects",
      value: "0",
      description: "Active projects",
      icon: FolderKanban,
      trend: null,
    },
    {
      title: "Total Milestones",
      value: "0",
      description: "Across all projects",
      icon: Target,
      trend: null,
    },
    {
      title: "Completed",
      value: "0",
      description: "Milestones completed",
      icon: CheckCircle2,
      trend: null,
    },
    {
      title: "In Progress",
      value: "0",
      description: "Currently active",
      icon: Clock,
      trend: null,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Projects */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Projects</CardTitle>
            <CardDescription>
              Your most recently updated projects
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FolderKanban className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-sm text-muted-foreground">
                No projects yet. Create your first project to get started.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Milestones</CardTitle>
            <CardDescription>
              Milestones due in the next 7 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Target className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-sm text-muted-foreground">
                No upcoming milestones. Add milestones to your projects.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Progress</CardTitle>
          <CardDescription>
            Milestone completion across all projects
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span>0 of 0 milestones completed</span>
            <span className="font-medium">0%</span>
          </div>
          <Progress value={0} className="h-2" />
        </CardContent>
      </Card>
    </div>
  );
}
