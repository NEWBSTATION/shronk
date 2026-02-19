import { useRef, useState, useCallback, useEffect } from 'react';

export function useMagnetic(strength = 0.3, radius = 100) {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!ref.current) return;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const rect = ref.current!.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < radius) {
          const pull = 1 - dist / radius;
          setOffset({ x: dx * strength * pull, y: dy * strength * pull });
        } else {
          setOffset((prev) => (prev.x === 0 && prev.y === 0 ? prev : { x: 0, y: 0 }));
        }
      });
    },
    [strength, radius]
  );

  const handleMouseLeave = useCallback(() => {
    setOffset((prev) => (prev.x === 0 && prev.y === 0 ? prev : { x: 0, y: 0 }));
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(rafRef.current);
    };
  }, [handleMouseMove, handleMouseLeave]);

  return {
    ref,
    style: {
      transform: `translate(${offset.x}px, ${offset.y}px)`,
      transition: offset.x === 0 && offset.y === 0
        ? "transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)"
        : "transform 0.15s ease-out",
    } as const,
  };
}
