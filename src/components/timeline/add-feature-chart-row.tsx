'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { addDays } from 'date-fns';
import { Link2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { pixelToDate, dateToPixel } from './date-math';
import { ROW_HEIGHT } from './scales-config';

export interface ChainInfo {
  featureId: string;
  featureTitle: string;
  endDate: Date;
}

interface AddFeatureChartRowProps {
  rowIndex: number;
  totalWidth: number;
  pixelsPerDay: number;
  timelineStart: Date;
  chainInfo?: ChainInfo | null;
  onQuickCreate: (name: string, startDate: Date, endDate: Date, duration: number, chainToId?: string) => Promise<void>;
}

export function AddFeatureChartRow({
  rowIndex,
  totalWidth,
  pixelsPerDay,
  timelineStart,
  chainInfo,
  onQuickCreate,
}: AddFeatureChartRowProps) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [popover, setPopover] = useState<{
    absoluteX: number;
    clientX: number;
    clientY: number;
    date: Date;
  } | null>(null);
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [chainActive, setChainActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Track shift key for chain mode
  const [shiftHeld, setShiftHeld] = useState(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftHeld(true); };
    const up = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftHeld(false); };
    const blur = () => setShiftHeld(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  const showChainHint = shiftHeld && !!chainInfo && !popover;

  const top = rowIndex * ROW_HEIGHT;

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (popover) return;
      const rect = e.currentTarget.getBoundingClientRect();
      setHoverX(e.clientX - rect.left);
      setIsHovering(true);
    },
    [popover]
  );

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
    if (!popover) setHoverX(null);
  }, [popover]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (popover) return;
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();

      const shouldChain = e.shiftKey && !!chainInfo;
      setChainActive(shouldChain);

      let absoluteX: number;
      let date: Date;

      if (shouldChain && chainInfo) {
        // Snap to chain start (predecessor end + 1 day)
        date = addDays(chainInfo.endDate, 1);
        absoluteX = dateToPixel(date, timelineStart, pixelsPerDay);
      } else {
        absoluteX = e.clientX - rect.left;
        date = pixelToDate(absoluteX, timelineStart, pixelsPerDay);
      }

      setPopover({ absoluteX, clientX: e.clientX, clientY: e.clientY, date });
      setHoverX(absoluteX);
      setName('');
    },
    [popover, timelineStart, pixelsPerDay, chainInfo]
  );

  // Focus input when popover opens
  useEffect(() => {
    if (popover) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [popover]);

  // Close popover on Escape
  useEffect(() => {
    if (!popover) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPopover(null);
        setHoverX(null);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [popover]);

  // Close popover on outside click
  useEffect(() => {
    if (!popover) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopover(null);
        setHoverX(null);
      }
    };
    const timeout = setTimeout(() => {
      document.addEventListener('mousedown', handler);
    }, 0);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mousedown', handler);
    };
  }, [popover]);

  // Close popover on scroll
  useEffect(() => {
    if (!popover) return;
    const zone = zoneRef.current;
    if (!zone) return;
    const scrollArea = zone.closest('.timeline-scroll-area') as HTMLElement;
    if (!scrollArea) return;
    const handler = () => {
      setPopover(null);
      setHoverX(null);
    };
    scrollArea.addEventListener('scroll', handler);
    return () => scrollArea.removeEventListener('scroll', handler);
  }, [popover]);

  const handleSubmit = useCallback(async () => {
    if (!name.trim() || !popover || isCreating) return;
    setIsCreating(true);
    try {
      const startDate = popover.date;
      const endDate = addDays(startDate, 6); // 7 day duration, inclusive end
      await onQuickCreate(
        name.trim(),
        startDate,
        endDate,
        7,
        chainActive && chainInfo ? chainInfo.featureId : undefined
      );
      setPopover(null);
      setHoverX(null);
      setName('');
      setChainActive(false);
    } finally {
      setIsCreating(false);
    }
  }, [name, popover, isCreating, onQuickCreate, chainActive, chainInfo]);

  return (
    <>
      {/* Interactive zone covering the add-feature row in the chart */}
      <div
        ref={zoneRef}
        style={{
          position: 'absolute',
          left: 0,
          top,
          width: totalWidth,
          height: ROW_HEIGHT,
          cursor: popover ? 'default' : 'crosshair',
          zIndex: 5,
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={handleClick}
      >
        {/* Hover dot + label */}
        {hoverX !== null && !popover && isHovering && (
          <div
            style={{
              position: 'absolute',
              left: showChainHint && chainInfo
                ? dateToPixel(addDays(chainInfo.endDate, 1), timelineStart, pixelsPerDay)
                : hoverX,
              top: ROW_HEIGHT / 2,
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
            }}
          >
            {showChainHint ? (
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  backgroundColor: 'color-mix(in srgb, var(--primary) 15%, transparent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Link2 style={{ width: 11, height: 11, color: 'var(--primary)' }} />
              </div>
            ) : (
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: 'var(--primary)',
                  boxShadow: '0 0 0 3px color-mix(in srgb, var(--primary) 25%, transparent)',
                  flexShrink: 0,
                }}
              />
            )}
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: showChainHint ? 'var(--primary)' : 'var(--muted-foreground)',
              }}
            >
              {showChainHint ? 'Click to chain feature' : 'Click to create feature'}
            </span>
          </div>
        )}

        {/* Dot indicator when popover is open */}
        {popover && (
          <div
            style={{
              position: 'absolute',
              left: popover.absoluteX,
              top: ROW_HEIGHT / 2,
              transform: 'translate(-50%, -50%)',
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: 'var(--primary)',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>

      {/* Popover rendered via portal to avoid scroll clipping */}
      {popover &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              left: popover.clientX,
              top: popover.clientY - 16,
              transform: 'translate(-50%, -100%)',
              zIndex: 9999,
            }}
          >
            <div
              className="bg-popover border border-border rounded-lg shadow-lg"
              style={{ minWidth: 260, padding: 12 }}
            >
              <div
                className="text-xs font-medium text-muted-foreground"
                style={{ marginBottom: 8 }}
              >
                Create Feature
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSubmit();
                    e.stopPropagation();
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  placeholder="Feature name"
                  className="flex-1 h-8 px-2 text-sm border border-input rounded-md bg-background outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  onClick={handleSubmit}
                  disabled={!name.trim() || isCreating}
                  className="h-8 px-3 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                >
                  Create
                </button>
              </div>
              {chainInfo && (
                <div
                  style={{ marginTop: 8 }}
                  className="flex items-center gap-2"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <Link2 style={{ width: 12, height: 12, flexShrink: 0 }} className="text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground truncate flex-1">
                    Chain after {chainInfo.featureTitle}
                  </span>
                  <Switch
                    size="sm"
                    checked={chainActive}
                    onCheckedChange={(checked) => {
                      setChainActive(checked);
                      if (checked && chainInfo && popover) {
                        const chainDate = addDays(chainInfo.endDate, 1);
                        setPopover({
                          ...popover,
                          date: chainDate,
                          absoluteX: dateToPixel(chainDate, timelineStart, pixelsPerDay),
                        });
                      }
                    }}
                  />
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
