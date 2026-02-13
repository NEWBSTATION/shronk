"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard error]", error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4 grayscale-[0.3]">&#x1f6a7;</div>
        <h2 className="text-lg font-semibold tracking-tight mb-1">
          Something went wrong
        </h2>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          This page hit an error. Your data is safe&mdash;try reloading.
          {error.digest && (
            <span className="block mt-2">
              <code className="text-xs bg-muted px-2 py-0.5 rounded">
                {error.digest}
              </code>
            </span>
          )}
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-6 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
