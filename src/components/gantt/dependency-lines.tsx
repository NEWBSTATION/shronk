import { useState, useMemo } from 'react';
import type { DependencyLinesProps, DependencyLine } from './types';

export function DependencyLines({
  milestones,
  getBarPosition,
  rowHeight,
  onDependencyClick,
  creationState,
}: DependencyLinesProps) {
  const [hoveredLine, setHoveredLine] = useState<string | null>(null);

  // Build milestone index map for row lookups
  const milestoneIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    milestones.forEach((m, i) => map.set(m.id, i));
    return map;
  }, [milestones]);

  // Calculate dependency lines
  const dependencyLines = useMemo(() => {
    const lines: DependencyLine[] = [];

    milestones.forEach((milestone) => {
      if (!milestone.dependencies || milestone.dependencies.length === 0) return;

      const toIndex = milestoneIndexMap.get(milestone.id);
      if (toIndex === undefined) return;

      const toPos = getBarPosition(milestone);

      milestone.dependencies.forEach((dep) => {
        const fromIndex = milestoneIndexMap.get(dep.id);
        if (fromIndex === undefined) return;

        const fromMilestone = milestones.find((m) => m.id === dep.id);
        if (!fromMilestone) return;

        const fromPos = getBarPosition(fromMilestone);

        lines.push({
          fromId: dep.id,
          toId: milestone.id,
          fromX: fromPos.left + fromPos.width,
          fromY: fromIndex * rowHeight + rowHeight / 2,
          toX: toPos.left,
          toY: toIndex * rowHeight + rowHeight / 2,
        });
      });
    });

    return lines;
  }, [milestones, milestoneIndexMap, getBarPosition, rowHeight]);

  // Generate SVG path for a dependency line
  // Linear.app style: smooth bezier curves that flow naturally
  const getLinePath = (line: DependencyLine) => {
    const { fromX, fromY, toX, toY } = line;
    const horizontalGap = toX - fromX;
    const isSameRow = Math.abs(toY - fromY) < 5;

    if (isSameRow) {
      // Same row: straight horizontal line
      return `M ${fromX} ${fromY} L ${toX} ${toY}`;
    }

    // Control point offset - how far the curve extends horizontally before turning
    const controlOffset = Math.max(Math.abs(horizontalGap) * 0.5, 20);

    if (horizontalGap >= 0) {
      // Normal left-to-right or adjacent: smooth S-curve
      return `M ${fromX} ${fromY}
              C ${fromX + controlOffset} ${fromY},
                ${toX - controlOffset} ${toY},
                ${toX} ${toY}`;
    } else {
      // Backwards connection (target is to the left of source)
      // Route around: go right first, then curve back left
      const loopOffset = Math.max(30, Math.abs(horizontalGap) + 20);

      return `M ${fromX} ${fromY}
              C ${fromX + loopOffset} ${fromY},
                ${toX - loopOffset} ${toY},
                ${toX} ${toY}`;
    }
  };

  const totalHeight = milestones.length * rowHeight;

  return (
    <svg
      className="absolute inset-0 pointer-events-none overflow-visible"
      style={{
        width: '100%',
        height: totalHeight,
      }}
    >
      {/* Render dependency lines */}
      {dependencyLines.map((line) => {
        const lineId = `${line.fromId}-${line.toId}`;
        const isHovered = hoveredLine === lineId;

        return (
          <g key={lineId}>
            {/* Invisible wider path for easier hover/click */}
            <path
              d={getLinePath(line)}
              fill="none"
              stroke="transparent"
              strokeWidth={16}
              className="pointer-events-auto cursor-pointer"
              onMouseEnter={() => setHoveredLine(lineId)}
              onMouseLeave={() => setHoveredLine(null)}
              onClick={(e) => {
                e.stopPropagation();
                onDependencyClick?.(line.fromId, line.toId);
              }}
            />
            {/* Visible line - Linear.app style: smooth, subtle */}
            <path
              d={getLinePath(line)}
              fill="none"
              stroke={isHovered ? 'var(--primary)' : 'color-mix(in srgb, var(--muted-foreground) 35%, transparent)'}
              strokeWidth={isHovered ? 1.5 : 1}
              strokeLinecap="round"
              className="transition-all duration-150"
            />
            {/* Small dot at the target connection point */}
            <circle
              cx={line.toX}
              cy={line.toY}
              r={isHovered ? 3.5 : 2.5}
              fill={isHovered ? 'var(--primary)' : 'color-mix(in srgb, var(--muted-foreground) 35%, transparent)'}
              className="transition-all duration-150"
            />
          </g>
        );
      })}

      {/* Render creation line (when dragging to create new dependency) */}
      {creationState && (
        <path
          d={`M ${creationState.fromX} ${creationState.fromY} L ${creationState.currentX} ${creationState.currentY}`}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={2}
          strokeDasharray="3,2"
          strokeLinecap="round"
          className="animate-pulse"
        />
      )}
    </svg>
  );
}
