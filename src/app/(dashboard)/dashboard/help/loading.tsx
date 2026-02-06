import { Skeleton } from "@/components/ui/skeleton";

export default function HelpLoading() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Skeleton className="h-[500px] w-[400px] rounded-lg" />
    </div>
  );
}
