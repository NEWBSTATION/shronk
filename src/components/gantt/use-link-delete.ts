import { useEffect, type RefObject, type MutableRefObject } from 'react';

/**
 * Floating delete button for dependency links.
 *
 * When the user clicks on a dependency line (`.wx-line` SVG polyline),
 * a small delete button appears near the click position. Clicking it
 * deletes the dependency. Clicking elsewhere dismisses it.
 *
 * SVAR adds `data-link-id` to each polyline, matching our dependency ID.
 */
export function useLinkDelete(
  containerRef: RefObject<HTMLDivElement | null>,
  onDeleteDependencyRef: MutableRefObject<(id: string) => Promise<void>>,
) {
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    let deleteBtn: HTMLButtonElement | null = null;
    let activeLinkId: string | null = null;

    function removeButton() {
      if (deleteBtn) {
        deleteBtn.remove();
        deleteBtn = null;
      }
      activeLinkId = null;
    }

    function showDeleteButton(linkId: string, clientX: number, clientY: number) {
      removeButton();
      activeLinkId = linkId;

      const btn = document.createElement('button');
      btn.className = 'link-delete-btn';
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      btn.title = 'Remove dependency';

      // Position relative to the container
      const containerRect = container.getBoundingClientRect();
      const x = clientX - containerRect.left;
      const y = clientY - containerRect.top;
      btn.style.left = `${x}px`;
      btn.style.top = `${y}px`;

      btn.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
      });

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (activeLinkId) {
          onDeleteDependencyRef.current(activeLinkId);
        }
        removeButton();
      });

      container.appendChild(btn);
      deleteBtn = btn;
    }

    function handleClick(e: MouseEvent) {
      const target = e.target as Element | null;
      if (!target) return;

      // Check if clicking on a dependency line
      const line = target.closest('.wx-line');
      if (line) {
        const linkId = line.getAttribute('data-link-id');
        if (linkId) {
          // Small delay to let SVAR process its own click first
          requestAnimationFrame(() => {
            showDeleteButton(linkId, e.clientX, e.clientY);
          });
          return;
        }
      }

      // Check if clicking on the delete button itself (handled by its own listener)
      if (target.closest('.link-delete-btn')) return;

      // Clicking elsewhere — dismiss
      removeButton();
    }

    // Also dismiss on Delete/Backspace key when a link is selected
    function handleKeyDown(e: KeyboardEvent) {
      if (!activeLinkId) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        onDeleteDependencyRef.current(activeLinkId);
        removeButton();
      } else if (e.key === 'Escape') {
        removeButton();
      }
    }

    // Dismiss on scroll
    function handleScroll() {
      removeButton();
    }

    container.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeyDown);

    // Find the scroll container and listen for scroll
    const wxArea = container.querySelector('.wx-area') as HTMLElement;
    const scrollEl = wxArea?.parentElement;
    scrollEl?.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
      scrollEl?.removeEventListener('scroll', handleScroll);
      removeButton();
    };
  }, [containerRef, onDeleteDependencyRef]);
}
