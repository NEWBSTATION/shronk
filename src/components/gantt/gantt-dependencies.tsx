"use client";

import { useState, useMemo, useCallback } from "react";
import { calculateBarPosition, type TimelineRange } from "./utils/date-calculations";
import type { Milestone, MilestoneDependency } from "@/db/schema";

interface GanttDependenciesProps {
  milestones: Milestone[];
  dependencies: MilestoneDependency[];
  timelineRange: TimelineRange;
  dayWidth: number;
  rowHeight: number;
  scrollTop: number;
  scrollLeft: number;
  onCreateDependency: (predecessorId: string, successorId: string) => void;
  onDeleteDependency: (id: string) => void;
}

const BAR_HEIGHT = 32;
const HEADER_HEIGHT = 72;

interface DependencyLine {
  id: string;
  predecessorId: string;
  successorId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  path: string;
}

export function GanttDependencies({
  milestones,
  dependencies,
  timelineRange,
  dayWidth,
  rowHeight,
  scrollTop,
  scrollLeft,
  onCreateDependency,
  onDeleteDependency,
}: GanttDependenciesProps) {
  const [hoveredDependency, setHoveredDependency] = useState<string | null>(null);
  const [creatingDependency, setCreatingDependency] = useState<{
    predecessorId: string;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  // Create milestone position map
  const milestonePositions = useMemo(() => {
    const positions = new Map<
      string,
      { left: number; width: number; top: number; rowIndex: number }
    >();

    milestones.forEach((milestone, index) => {
      const barPosition = calculateBarPosition(
        milestone.startDate,
        milestone.endDate,
        timelineRange.start,
        dayWidth
      );

      const top = index * rowHeight + (rowHeight - BAR_HEIGHT) / 2;

      positions.set(milestone.id, {
        left: barPosition.left,
        width: barPosition.width,
        top,
        rowIndex: index,
      });
    });

    return positions;
  }, [milestones, timelineRange.start, dayWidth, rowHeight]);

  // Calculate dependency lines
  const dependencyLines = useMemo((): DependencyLine[] => {
    return dependencies
      .map((dep) => {
        const predecessor = milestonePositions.get(dep.predecessorId);
        const successor = milestonePositions.get(dep.successorId);

        if (!predecessor || !successor) return null;

        // Start from right edge of predecessor
        const x1 = predecessor.left + predecessor.width;
        const y1 = predecessor.top + BAR_HEIGHT / 2;

        // End at left edge of successor
        const x2 = successor.left;
        const y2 = successor.top + BAR_HEIGHT / 2;

        // Create bezier curve path
        const midX = (x1 + x2) / 2;
        const path = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;

        return {
          id: dep.id,
          predecessorId: dep.predecessorId,
          successorId: dep.successorId,
          x1,
          y1,
          x2,
          y2,
          path,
        };
      })
      .filter((line): line is DependencyLine => line !== null);
  }, [dependencies, milestonePositions]);

  const handleDependencyClick = useCallback(
    (id: string) => {
      if (confirm("Delete this dependency?")) {
        onDeleteDependency(id);
      }
    },
    [onDeleteDependency]
  );

  // Handle creating new dependencies
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, predecessorId: string) => {
      e.preventDefault();
      e.stopPropagation();

      const predecessor = milestonePositions.get(predecessorId);
      if (!predecessor) return;

      const startX = predecessor.left + predecessor.width;
      const startY = predecessor.top + BAR_HEIGHT / 2;

      setCreatingDependency({
        predecessorId,
        startX,
        startY,
        currentX: startX,
        currentY: startY,
      });
    },
    [milestonePositions]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!creatingDependency) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left + scrollLeft;
      const y = e.clientY - rect.top + scrollTop;

      setCreatingDependency((prev) =>
        prev ? { ...prev, currentX: x, currentY: y } : null
      );
    },
    [creatingDependency, scrollLeft, scrollTop]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!creatingDependency) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left + scrollLeft;
      const y = e.clientY - rect.top + scrollTop;

      // Find if we're over a milestone
      for (const [id, pos] of milestonePositions) {
        if (
          id !== creatingDependency.predecessorId &&
          x >= pos.left &&
          x <= pos.left + pos.width &&
          y >= pos.top &&
          y <= pos.top + BAR_HEIGHT
        ) {
          onCreateDependency(creatingDependency.predecessorId, id);
          break;
        }
      }

      setCreatingDependency(null);
    },
    [creatingDependency, milestonePositions, onCreateDependency, scrollLeft, scrollTop]
  );

  // Calculate visible area for rendering
  const contentHeight = milestones.length * rowHeight;

  return (
    <svg
      className="absolute top-[72px] left-0 pointer-events-none"
      style={{
        width: "100%",
        height: contentHeight,
        overflow: "visible",
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="10"
          refY="3.5"
          orient="auto"
        >
          <polygon
            points="0 0, 10 3.5, 0 7"
            fill="hsl(var(--muted-foreground))"
          />
        </marker>
        <marker
          id="arrowhead-hover"
          markerWidth="10"
          markerHeight="7"
          refX="10"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--destructive))" />
        </marker>
      </defs>

      {/* Dependency lines */}
      {dependencyLines.map((line) => (
        <g key={line.id}>
          {/* Invisible wider hit area for clicking */}
          <path
            d={line.path}
            fill="none"
            stroke="transparent"
            strokeWidth="16"
            className="pointer-events-auto cursor-pointer"
            onClick={() => handleDependencyClick(line.id)}
            onMouseEnter={() => setHoveredDependency(line.id)}
            onMouseLeave={() => setHoveredDependency(null)}
          />
          {/* Visible line */}
          <path
            d={line.path}
            fill="none"
            stroke={
              hoveredDependency === line.id
                ? "hsl(var(--destructive))"
                : "hsl(var(--muted-foreground))"
            }
            strokeWidth={hoveredDependency === line.id ? 2 : 1.5}
            strokeDasharray={hoveredDependency === line.id ? "4 2" : "none"}
            markerEnd={
              hoveredDependency === line.id
                ? "url(#arrowhead-hover)"
                : "url(#arrowhead)"
            }
          />
          {/* Target circle */}
          <circle
            cx={line.x2}
            cy={line.y2}
            r={4}
            fill={
              hoveredDependency === line.id
                ? "hsl(var(--destructive))"
                : "hsl(var(--muted-foreground))"
            }
          />
        </g>
      ))}

      {/* Connection handles on bars */}
      {milestones.map((milestone) => {
        const pos = milestonePositions.get(milestone.id);
        if (!pos) return null;

        return (
          <circle
            key={milestone.id}
            cx={pos.left + pos.width}
            cy={pos.top + BAR_HEIGHT / 2}
            r={6}
            fill="hsl(var(--primary))"
            stroke="hsl(var(--background))"
            strokeWidth={2}
            className="pointer-events-auto cursor-crosshair opacity-0 hover:opacity-100 transition-opacity"
            onMouseDown={(e) => handleMouseDown(e, milestone.id)}
          />
        );
      })}

      {/* Creating dependency preview line */}
      {creatingDependency && (
        <line
          x1={creatingDependency.startX}
          y1={creatingDependency.startY}
          x2={creatingDependency.currentX}
          y2={creatingDependency.currentY}
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          strokeDasharray="4 2"
          className="pointer-events-none"
        />
      )}
    </svg>
  );
}
