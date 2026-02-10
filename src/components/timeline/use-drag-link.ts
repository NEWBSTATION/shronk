import { useEffect, type RefObject, type MutableRefObject } from 'react';

/**
 * Drag-to-connect dependency creation.
 *
 * Intercepts mousedown on SVAR's `.wx-link` handles (capture phase, before SVAR
 * sees it), draws an SVG bezier overlay from source to cursor, and creates a
 * dependency when the user releases over another task's link handle.
 *
 * If the user clicks without dragging (< 5px movement), a synthetic click is
 * dispatched so SVAR's built-in click-based link flow still works.
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

    const DRAG_THRESHOLD = 5;

    // --- Helpers ---

    /** Walk up from a `.wx-link` handle to find the task bar's data-id */
    function getTaskIdFromHandle(handle: HTMLElement): string | null {
      // SVAR renders: .wx-bar[data-id] > ... > .wx-link
      let el: HTMLElement | null = handle;
      while (el && el !== container) {
        const id = el.getAttribute('data-id');
        if (id) return id;
        el = el.parentElement;
      }
      return null;
    }

    /** Create the SVG overlay element */
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

    /** Compute a cubic bezier path from (x1,y1) to (x2,y2) */
    function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
      const dx = Math.abs(x2 - x1) * 0.5;
      return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
    }

    /** Update the overlay path from source handle center to (cursorX, cursorY) in container coords */
    function updatePath(cursorX: number, cursorY: number) {
      if (!pathEl || !sourceHandle) return;
      const containerRect = container.getBoundingClientRect();
      const handleRect = sourceHandle.getBoundingClientRect();
      const sx = handleRect.left + handleRect.width / 2 - containerRect.left;
      const sy = handleRect.top + handleRect.height / 2 - containerRect.top;
      pathEl.setAttribute('d', bezierPath(sx, sy, cursorX, cursorY));
    }

    /** Find the link handle under the cursor (hides SVG temporarily to see through) */
    function getTargetHandle(clientX: number, clientY: number): HTMLElement | null {
      if (svgOverlay) svgOverlay.style.display = 'none';
      const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
      if (svgOverlay) svgOverlay.style.display = '';
      if (!el) return null;
      // Check if element or ancestor is a .wx-link
      let cur: HTMLElement | null = el;
      while (cur && cur !== container) {
        if (cur.classList.contains('wx-link')) return cur;
        cur = cur.parentElement;
      }
      return null;
    }

    // --- Track currently hovered target for styling ---
    let hoveredTarget: HTMLElement | null = null;

    function setHoveredTarget(target: HTMLElement | null) {
      if (hoveredTarget === target) return;
      if (hoveredTarget) hoveredTarget.classList.remove('drag-link-target-hover');
      hoveredTarget = target;
      if (hoveredTarget) hoveredTarget.classList.add('drag-link-target-hover');
    }

    // --- Event handlers ---

    function onMouseDown(e: MouseEvent) {
      if (e.button !== 0) return;

      // Check if target is a .wx-link handle
      let handle: HTMLElement | null = e.target as HTMLElement;
      while (handle && handle !== container) {
        if (handle.classList.contains('wx-link')) break;
        handle = handle.parentElement;
      }
      if (!handle || !handle.classList.contains('wx-link')) return;

      const taskId = getTaskIdFromHandle(handle);
      if (!taskId || taskId === sentinelId) return;

      // Stop SVAR from starting bar drag
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

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (!isDragging) {
        if (dist < DRAG_THRESHOLD) return;
        // Start drag
        isDragging = true;
        hasMoved = true;
        container.classList.add('drag-link-active');
        sourceHandle.classList.add('drag-link-source');
        svgOverlay = createOverlay();
      }

      const containerRect = container.getBoundingClientRect();
      const cursorX = e.clientX - containerRect.left;
      const cursorY = e.clientY - containerRect.top;
      updatePath(cursorX, cursorY);

      // Highlight target handle
      const target = getTargetHandle(e.clientX, e.clientY);
      if (target && target !== sourceHandle) {
        const targetTaskId = getTaskIdFromHandle(target);
        if (targetTaskId && targetTaskId !== sourceTaskId && targetTaskId !== sentinelId) {
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

      if (!hasMoved && sourceHandle) {
        // User just clicked — dispatch synthetic click so SVAR's click-based link flow works
        const syntheticClick = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          clientX: e.clientX,
          clientY: e.clientY,
        });
        sourceHandle.dispatchEvent(syntheticClick);
      }

      if (isDragging) {
        // Check if we're over a valid target
        const target = getTargetHandle(e.clientX, e.clientY);
        if (target && target !== sourceHandle) {
          const targetTaskId = getTaskIdFromHandle(target);
          if (targetTaskId && targetTaskId !== sourceTaskId && targetTaskId !== sentinelId && sourceTaskId) {
            onCreateDependencyRef.current(sourceTaskId, targetTaskId);
          }
        }

        // Suppress the next click event that the browser fires after mouseup
        const suppressClick = (ev: MouseEvent) => {
          ev.stopPropagation();
          ev.preventDefault();
        };
        document.addEventListener('click', suppressClick, { capture: true, once: true });
        // Safety: remove the suppressor after a tick in case no click fires
        setTimeout(() => document.removeEventListener('click', suppressClick, { capture: true }), 0);
      }

      // Cleanup
      cleanup();
    }

    function cleanup() {
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

    // Attach in capture phase so we see the event before SVAR
    container.addEventListener('mousedown', onMouseDown, { capture: true });

    return () => {
      container.removeEventListener('mousedown', onMouseDown, { capture: true });
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      cleanup();
    };
  }, [containerRef, onCreateDependencyRef, sentinelId]);
}
