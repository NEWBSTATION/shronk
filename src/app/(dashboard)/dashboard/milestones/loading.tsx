import { Skeleton } from "@/components/ui/skeleton";

export default function MilestonesLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-32" />
      </div>
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
