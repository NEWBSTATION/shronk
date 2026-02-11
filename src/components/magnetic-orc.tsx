"use client";

import { useRef, useState, useCallback } from "react";
import Image from "next/image";

export function MagneticOrc() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distX = e.clientX - centerX;
    const distY = e.clientY - centerY;
    // Strength of the pull (higher = more movement)
    const strength = 0.3;
    setOffset({ x: distX * strength, y: distY * strength });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setOffset({ x: 0, y: 0 });
  }, []);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative cursor-none p-12"
    >
      <div className="absolute -inset-6 animate-pulse rounded-full bg-foreground/[0.04] blur-xl" />
      <div
        className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-[#111] shadow-[0_4px_30px_rgba(0,0,0,0.25)] ring-1 ring-white/[0.06] transition-transform duration-200 ease-out"
        style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
      >
        <Image src="/orc-head.svg" alt="Shronk" width={48} height={48} />
      </div>
    </div>
  );
}
