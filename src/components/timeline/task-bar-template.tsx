import type { ITask, IApi } from '@svar-ui/react-gantt';

interface TaskBarTemplateProps {
  data: ITask;
  api: IApi;
  onaction: (ev: { action: string; data: { [key: string]: unknown } }) => void;
}

/**
 * Custom task bar template that renders the task label to the right
 * of the bar instead of inside it, so it's always visible and never truncated.
 */
export function TaskBarTemplate({ data }: TaskBarTemplateProps) {
  if (!data.text) return null;

  return (
    <div className="timeline-bar-label" title={data.text}>
      {data.text}
    </div>
  );
}
