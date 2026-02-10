"use client";

interface DrilldownPanelProps {
  title?: string;
  children: React.ReactNode;
  showBack?: boolean;
}

/**
 * Thin wrapper for drilldown content.
 * Individual panel components (FeatureDetailPanel, MilestoneDetailPanel)
 * now own their own navigation headers.
 */
export function DrilldownPanel({
  children,
}: DrilldownPanelProps) {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {children}
    </div>
  );
}
