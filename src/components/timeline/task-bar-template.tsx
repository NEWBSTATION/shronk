import { useMemo, useRef, useEffect } from 'react';
import { format, subDays } from 'date-fns';
import type { ITask, IApi } from '@svar-ui/react-gantt';

interface TaskBarTemplateProps {
  data: ITask;
  api: IApi;
  onaction: (ev: { action: string; data: { [key: string]: unknown } }) => void;
}

/** Build a "MMM d, yyyy — MMM d, yyyy" title from SVAR's exclusive-end dates */
function dateRangeTitle(data: ITask): string {
  if (!data.start || !data.end) return data.text || '';
  try {
    const start = data.start as Date;
    const inclusiveEnd = subDays(data.end as Date, 1);
    return `${data.text}\n${format(start, 'MMM d, yyyy')} — ${format(inclusiveEnd, 'MMM d, yyyy')}`;
  } catch {
    return data.text || '';
  }
}

/**
 * Custom task bar template that renders the task label + duration badge
 * to the right of the bar, so it's always visible regardless of bar width.
 *
 * For team track bars, applies the team color as the bar background.
 */
export function TaskBarTemplate({ data }: TaskBarTemplateProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const custom = (data as any).$custom;
  const isTeamTrack = custom?.isTeamTrack;
  const teamColor = custom?.teamColor;
  const durationText = (data as { durationText?: string }).durationText;
  const ref = useRef<HTMLDivElement>(null);
  const title = useMemo(() => dateRangeTitle(data), [data]);

  // Style the team track bar: muted color + diagonal stripes + mark the row
  // Uses setProperty with 'important' to override SVAR's !important CSS rules
  useEffect(() => {
    if (!ref.current) return;
    // Walk up to the .wx-bar element
    let bar: HTMLElement | null = ref.current;
    while (bar && !bar.classList.contains('wx-bar')) {
      bar = bar.parentElement;
    }
    if (!bar) return;

    if (isTeamTrack && teamColor) {
      bar.style.setProperty(
        'background-color',
        `color-mix(in srgb, ${teamColor} 40%, var(--background))`,
        'important'
      );
      bar.style.setProperty(
        'background-image',
        `repeating-linear-gradient(-45deg, transparent, transparent 3px, ${teamColor}18 3px, ${teamColor}18 6px)`,
        'important'
      );
      bar.classList.add('wx-team-track');

      // Walk up further to mark the chart row
      let row: HTMLElement | null = bar.parentElement;
      while (row && !row.className.includes('wx-row')) {
        row = row.parentElement;
      }
      if (row) {
        row.classList.add('wx-team-track-row');
      }
    }

    return () => {
      if (!bar) return;
      bar.style.removeProperty('background-color');
      bar.style.removeProperty('background-image');
      bar.classList.remove('wx-team-track');
    };
  }, [isTeamTrack, teamColor]);

  if (isTeamTrack && teamColor) {
    return (
      <div ref={ref} className="timeline-bar-label timeline-bar-team-track" title={title}>
        <div
          className="h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: teamColor }}
        />
        {data.text}
        {durationText && (
          <span className="timeline-bar-duration">{durationText}</span>
        )}
      </div>
    );
  }

  // Summary bars — show name + duration
  if (data.type === 'summary') {
    if (!data.text) return null;
    return (
      <div className="timeline-bar-label" title={title}>
        {data.text}
        {durationText && (
          <span className="timeline-bar-duration">{durationText}</span>
        )}
      </div>
    );
  }

  if (!data.text) return null;

  return (
    <div className="timeline-bar-label" title={title}>
      {data.text}
      {durationText && (
        <span className="timeline-bar-duration">{durationText}</span>
      )}
    </div>
  );
}
