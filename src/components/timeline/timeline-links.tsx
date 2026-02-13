'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { dateToPixel, durationToPixels } from './date-math';
import { ROW_HEIGHT } from './scales-config';
import type { TimelineTask, TimelineLink } from './types';

interface TimelineLinksProps {
  tasks: TimelineTask[];
  links: TimelineLink[];
  pixelsPerDay: number;
  timelineStart: Date;
  hideTeamTracks?: boolean;
}

const DELTA = 20;    // stub length from bar edge
const R = 6;         // corner rounding radius
const ARROW_SIZE = 6;

/**
 * Convert an orthogonal polyline to an SVG path with rounded corners.
 * Uses quadratic bezier curves at each bend.
 */
function roundedPath(pts: [number, number][], r: number): string {
  if (pts.length < 2) return '';
  const parts: string[] = [`M ${pts[0][0]} ${pts[0][1]}`];

  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const [nx, ny] = pts[i + 1];

    // Skip degenerate (zero-length) segments
    const d1 = Math.abs(cx - px) + Math.abs(cy - py);
    const d2 = Math.abs(nx - cx) + Math.abs(ny - cy);
    if (d1 === 0 || d2 === 0) continue;

    const maxR = Math.min(r, d1 / 2, d2 / 2);

    // Unit directions (only orthogonal, so one axis is always 0)
    const ux1 = Math.sign(cx - px);
    const uy1 = Math.sign(cy - py);
    const ux2 = Math.sign(nx - cx);
    const uy2 = Math.sign(ny - cy);

    // Arc start: maxR before the corner
    const ax = cx - ux1 * maxR;
    const ay = cy - uy1 * maxR;
    // Arc end: maxR after the corner
    const bx = cx + ux2 * maxR;
    const by = cy + uy2 * maxR;

    parts.push(`L ${ax} ${ay}`);
    parts.push(`Q ${cx} ${cy} ${bx} ${by}`);
  }

  const last = pts[pts.length - 1];
  parts.push(`L ${last[0]} ${last[1]}`);
  return parts.join(' ');
}

export function TimelineLinks({ tasks, links, pixelsPerDay, timelineStart, hideTeamTracks }: TimelineLinksProps) {
  // Defer hideTeamTracks changes so links fade out at old positions,
  // then recompute at new positions and fade back in.
  const [deferredHide, setDeferredHide] = useState(hideTeamTracks);
  const [fading, setFading] = useState(false);
  const prevHideRef = useRef(hideTeamTracks);

  useEffect(() => {
    if (prevHideRef.current !== hideTeamTracks) {
      prevHideRef.current = hideTeamTracks;
      setFading(true);
      const timer = setTimeout(() => {
        setDeferredHide(hideTeamTracks);
        requestAnimationFrame(() => setFading(false));
      }, 300); // wait for bars to fully settle before showing links
      return () => clearTimeout(timer);
    }
  }, [hideTeamTracks]);

  const paths = useMemo(() => {
    if (links.length === 0) return [];

    // Build task index: id → { row, left, right, centerY }
    const taskIndex = new Map<string, { row: number; left: number; right: number; centerY: number }>();
    let rowIndex = 0;
    let adjustedRowIndex = 0;
    for (const task of tasks) {
      const isTeam = !!task.$custom?.isTeamTrack;
      const left = dateToPixel(task.startDate, timelineStart, pixelsPerDay);
      const width = durationToPixels(task.duration, pixelsPerDay);
      const effectiveRow = deferredHide ? adjustedRowIndex : rowIndex;
      const centerY = effectiveRow * ROW_HEIGHT + ROW_HEIGHT / 2;
      taskIndex.set(task.id, {
        row: effectiveRow,
        left,
        right: left + width,
        centerY,
      });
      rowIndex++;
      if (!isTeam) adjustedRowIndex++;
    }

    return links.map((link) => {
      const source = taskIndex.get(link.sourceId);
      const target = taskIndex.get(link.targetId);
      if (!source || !target) return null;

      // E2S: source right edge → target left edge
      const sx = source.right;
      const sy = source.centerY;
      const tx = target.left;
      const ty = target.centerY;

      const minRow = Math.min(source.row, target.row);
      const maxRow = Math.max(source.row, target.row);

      // Find the rightmost edge of any bar between source and target rows
      // so the vertical segment clears children / team tracks
      let intermediateRight = sx;
      for (const [, info] of taskIndex) {
        if (info.row > minRow && info.row < maxRow) {
          intermediateRight = Math.max(intermediateRight, info.right);
        }
      }

      const clearX = Math.max(sx + DELTA, intermediateRight + DELTA);
      const tx1 = tx - DELTA; // stub entry to target

      let pts: [number, number][];

      if (tx1 > clearX) {
        // Clear gap — Z-shape: stub right past children, drop to target level, into target
        pts = [[sx, sy], [clearX, sy], [clearX, ty], [tx, ty]];
      } else {
        // Close/overlap — S-shape: route through row boundary between children and target
        const midY = (maxRow) * ROW_HEIGHT; // top edge of target row (between children and target)
        pts = [[sx, sy], [clearX, sy], [clearX, midY], [tx1, midY], [tx1, ty], [tx, ty]];
      }

      const d = roundedPath(pts, R);
      return { id: link.id, sourceId: link.sourceId, targetId: link.targetId, d, tx, ty };
    }).filter(Boolean) as Array<{ id: string; sourceId: string; targetId: string; d: string; tx: number; ty: number }>;
  }, [tasks, links, pixelsPerDay, timelineStart, deferredHide]);

  if (paths.length === 0) return null;

  const totalHeight = tasks.length * ROW_HEIGHT;

  return (
    <svg
      className="timeline-links-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: totalHeight,
        pointerEvents: 'none',
        overflow: 'visible',
        opacity: fading ? 0 : 1,
        transition: 'opacity 200ms ease',
      }}
    >
      <defs>
        <marker
          id="timeline-arrow"
          markerWidth={ARROW_SIZE}
          markerHeight={ARROW_SIZE}
          refX={ARROW_SIZE}
          refY={ARROW_SIZE / 2}
          orient="auto"
        >
          <path
            d={`M 0 0 L ${ARROW_SIZE} ${ARROW_SIZE / 2} L 0 ${ARROW_SIZE} Z`}
            fill="var(--muted-foreground)"
          />
        </marker>
        <marker
          id="timeline-arrow-hover"
          markerWidth={ARROW_SIZE}
          markerHeight={ARROW_SIZE}
          refX={ARROW_SIZE}
          refY={ARROW_SIZE / 2}
          orient="auto"
        >
          <path
            d={`M 0 0 L ${ARROW_SIZE} ${ARROW_SIZE / 2} L 0 ${ARROW_SIZE} Z`}
            fill="var(--chart-2)"
          />
        </marker>
      </defs>
      {paths.map((p) => (
        <g key={p.id} data-link-id={p.id} data-link-source={p.sourceId} data-link-target={p.targetId} style={{ pointerEvents: 'auto' }}>
          {/* Invisible wide hit area for clicking */}
          <path
            d={p.d}
            fill="none"
            stroke="transparent"
            strokeWidth={12}
            style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
            className="timeline-link-hitarea"
          />
          {/* Visible line */}
          <path
            d={p.d}
            fill="none"
            stroke="var(--muted-foreground)"
            strokeWidth={1.5}
            className="timeline-link-line"
          />
        </g>
      ))}
    </svg>
  );
}
