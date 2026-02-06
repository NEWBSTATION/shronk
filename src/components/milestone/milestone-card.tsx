"use client";

import { format, differenceInDays } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Calendar,
  CircleCheck,
  ChevronRight,
  Clock,
  Layers,
} from "lucide-react";
import type { Project } from "@/db/schema";

interface MilestoneCardProps {
  milestone: Project;
  featureCount: number;
  completedFeatureCount: number;
  onClick: () => void;
}

export function MilestoneCard({
  milestone,
  featureCount,
  completedFeatureCount,
  onClick,
}: MilestoneCardProps) {
  const progress =
    featureCount > 0
      ? Math.round((completedFeatureCount / featureCount) * 100)
      : 0;

  const startDate = milestone.startDate
    ? new Date(milestone.startDate)
    : null;
  const endDate = milestone.endDate ? new Date(milestone.endDate) : null;

  const daysRemaining =
    endDate && endDate > new Date()
      ? differenceInDays(endDate, new Date())
      : null;

  const isOverdue = endDate && endDate < new Date() && progress < 100;
  const isCompleted = progress === 100;

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md hover:border-primary/50 group",
        isOverdue && "border-destructive/50",
        isCompleted && "border-green-500/50"
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg truncate group-hover:text-primary transition-colors">
              {milestone.name}
            </CardTitle>
            {milestone.description && (
              <CardDescription className="mt-1 line-clamp-2">
                {milestone.description}
              </CardDescription>
            )}
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 ml-2" />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Date Range */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>
            {startDate ? format(startDate, "MMM d") : "No start"} -{" "}
            {endDate ? format(endDate, "MMM d, yyyy") : "No end"}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Stats Row */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-4">
            {/* Feature Count */}
            <div className="flex items-center gap-1.5 text-sm">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <span>
                {completedFeatureCount}/{featureCount} features
              </span>
            </div>
          </div>

          {/* Status Badge */}
          {isCompleted ? (
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
              <CircleCheck className="h-3 w-3 mr-1" fill="currentColor" />
              Complete
            </Badge>
          ) : isOverdue ? (
            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
              <Clock className="h-3 w-3 mr-1" />
              Overdue
            </Badge>
          ) : daysRemaining !== null ? (
            <Badge variant="outline" className="text-muted-foreground">
              <Clock className="h-3 w-3 mr-1" />
              {daysRemaining} days left
            </Badge>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
