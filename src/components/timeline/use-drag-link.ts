import { useEffect, type RefObject, type MutableRefObject } from 'react';
import { isTeamTrackId } from './transformers';

/**
 * Drag-to-connect dependency creation.
 *
 * Intercepts mousedown on `.timeline-connect-handle` elements (capture phase),
 * draws an SVG bezier overlay from source to cursor, and creates a
 * dependency when the user releases over another task's connect handle.
 */
export function useDragLink(
  containerRef: RefObject<HTMLDivElement | null>,
  onCreateDependencyRef: MutableRefObject<(predecessorId: string, successorId: string) => Promise<void>>,
  sentinelId: string,
) {
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    let isDragging = false;
    let hasMoved = false;
    let sourceTaskId: string | null = null;
    let sourceHandle: HTMLElement | null = null;
    let startX = 0;
    let startY = 0;
    let svgOverlay: SVGSVGElement | null = null;
    let pathEl: SVGPathElement | null = null;
    let panRAF: number | null = null;
    let lastMouseEvent: MouseEvent | null = null;

    const DRAG_THRESHOLD = 5;
    const PAN_EDGE_SIZE = 60;  // px from edge to start panning
    const PAN_SPEED = 12;      // px per frame at the very edge

    /** Walk up from a handle to find the task bar's data-task-id */
    function getTaskIdFromHandle(handle: HTMLElement): string | null {
      let el: HTMLElement | null = handle;
      while (el && el !== container) {
        const id = el.getAttribute('data-task-id');
        if (id) return id;
        el = el.parentElement;
      }
      return null;
    }

    function createOverlay(): SVGSVGElement {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.classList.add('drag-link-overlay');
      container.appendChild(svg);

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('fill', 'none');
      svg.appendChild(path);
      pathEl = path;

      return svg;
    }

    function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
      const dx = Math.abs(x2 - x1) * 0.5;
      return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
    }

    function updatePath(cursorX: number, cursorY: number) {
      if (!pathEl || !sourceHandle) return;
      const containerRect = container.getBoundingClientRect();
      const handleRect = sourceHandle.getBoundingClientRect();
      const sx = handleRect.left + handleRect.width / 2 - containerRect.left;
      const sy = handleRect.top + handleRect.height / 2 - containerRect.top;
      pathEl.setAttribute('d', bezierPath(sx, sy, cursorX, cursorY));
    }

    function getTargetHandle(clientX: number, clientY: number): HTMLElement | null {
      if (svgOverlay) svgOverlay.style.display = 'none';
      const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
      if (svgOverlay) svgOverlay.style.display = '';
      if (!el) return null;
      let cur: HTMLElement | null = el;
      while (cur && cur !== container) {
        if (cur.classList.contains('timeline-connect-handle') ||
            cur.classList.contains('timeline-connect-handle-left') ||
            cur.classList.contains('timeline-connect-handle-right')) return cur;
        cur = cur.parentElement;
      }
      return null;
    }

    function getScrollArea(): HTMLElement | null {
      return container.querySelector('.timeline-scroll-area') as HTMLElement | null;
    }

    function stopPan() {
      if (panRAF !== null) {
        cancelAnimationFrame(panRAF);
        panRAF = null;
      }
    }

    function panLoop() {
      const scrollArea = getScrollArea();
      const e = lastMouseEvent;
      if (!scrollArea || !e || !isDragging) { stopPan(); return; }

      const rect = scrollArea.getBoundingClientRect();
      const cursorX = e.clientX;
      let scrollDelta = 0;

      if (cursorX < rect.left + PAN_EDGE_SIZE) {
        // Pan left — stronger the closer to edge
        const t = 1 - Math.max(0, cursorX - rect.left) / PAN_EDGE_SIZE;
        scrollDelta = -PAN_SPEED * t;
      } else if (cursorX > rect.right - PAN_EDGE_SIZE) {
        // Pan right
        const t = 1 - Math.max(0, rect.right - cursorX) / PAN_EDGE_SIZE;
        scrollDelta = PAN_SPEED * t;
      }

      if (scrollDelta !== 0) {
        scrollArea.scrollLeft += scrollDelta;
        // Re-draw the bezier since source handle position shifted
        const containerRect = container.getBoundingClientRect();
        updatePath(e.clientX - containerRect.left, e.clientY - containerRect.top);
      }

      panRAF = requestAnimationFrame(panLoop);
    }

    let hoveredTarget: HTMLElement | null = null;

    function setHoveredTarget(target: HTMLElement | null) {
      if (hoveredTarget === target) return;
      if (hoveredTarget) hoveredTarget.classList.remove('drag-link-target-hover');
      hoveredTarget = target;
      if (hoveredTarget) hoveredTarget.classList.add('drag-link-target-hover');
    }

    function onMouseDown(e: MouseEvent) {
      if (e.button !== 0) return;

      let handle: HTMLElement | null = e.target as HTMLElement;
      while (handle && handle !== container) {
        if (handle.classList.contains('timeline-connect-handle') ||
            handle.classList.contains('timeline-connect-handle-left') ||
            handle.classList.contains('timeline-connect-handle-right')) break;
        handle = handle.parentElement;
      }
      if (!handle || (!handle.classList.contains('timeline-connect-handle') &&
          !handle.classList.contains('timeline-connect-handle-left') &&
          !handle.classList.contains('timeline-connect-handle-right'))) return;

      const taskId = getTaskIdFromHandle(handle);
      if (!taskId || taskId === sentinelId || isTeamTrackId(taskId)) return;

      e.stopPropagation();

      sourceTaskId = taskId;
      sourceHandle = handle;
      startX = e.clientX;
      startY = e.clientY;
      isDragging = false;
      hasMoved = false;

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    }

    function onMouseMove(e: MouseEvent) {
      if (!sourceHandle) return;

      lastMouseEvent = e;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (!isDragging) {
        if (dist < DRAG_THRESHOLD) return;
        isDragging = true;
        hasMoved = true;
        container.classList.add('drag-link-active');
        sourceHandle.classList.add('drag-link-source');
        svgOverlay = createOverlay();
        // Start the auto-pan loop
        panRAF = requestAnimationFrame(panLoop);
      }

      const containerRect = container.getBoundingClientRect();
      const cursorX = e.clientX - containerRect.left;
      const cursorY = e.clientY - containerRect.top;
      updatePath(cursorX, cursorY);

      const target = getTargetHandle(e.clientX, e.clientY);
      if (target && target !== sourceHandle) {
        const targetTaskId = getTaskIdFromHandle(target);
        if (targetTaskId && targetTaskId !== sourceTaskId && targetTaskId !== sentinelId && !isTeamTrackId(targetTaskId)) {
          setHoveredTarget(target);
        } else {
          setHoveredTarget(null);
        }
      } else {
        setHoveredTarget(null);
      }
    }

    function onMouseUp(e: MouseEvent) {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      if (isDragging) {
        const target = getTargetHandle(e.clientX, e.clientY);
        if (target && target !== sourceHandle) {
          const targetTaskId = getTaskIdFromHandle(target);
          if (targetTaskId && targetTaskId !== sourceTaskId && targetTaskId !== sentinelId && !isTeamTrackId(targetTaskId) && sourceTaskId) {
            onCreateDependencyRef.current(sourceTaskId, targetTaskId);
          }
        }

        const suppressClick = (ev: MouseEvent) => {
          ev.stopPropagation();
          ev.preventDefault();
        };
        document.addEventListener('click', suppressClick, { capture: true, once: true });
        setTimeout(() => document.removeEventListener('click', suppressClick, { capture: true }), 0);
      }

      cleanup();
    }

    function cleanup() {
      stopPan();
      lastMouseEvent = null;
      isDragging = false;
      hasMoved = false;
      sourceTaskId = null;

      if (sourceHandle) {
        sourceHandle.classList.remove('drag-link-source');
        sourceHandle = null;
      }
      setHoveredTarget(null);
      container.classList.remove('drag-link-active');

      if (svgOverlay) {
        svgOverlay.remove();
        svgOverlay = null;
        pathEl = null;
      }
    }

    container.addEventListener('mousedown', onMouseDown, { capture: true });

    return () => {
      container.removeEventListener('mousedown', onMouseDown, { capture: true });
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      cleanup();
    };
  }, [containerRef, onCreateDependencyRef, sentinelId]);
}
