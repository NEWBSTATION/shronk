"use client";

import { useRef, useCallback } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { statusConfig, priorityConfig } from "./status-badge";
import { Pencil, Trash2, CheckCircle, Flag } from "lucide-react";

export interface FeatureContextMenuState {
  featureId: string;
  status: string;
  priority: string;
}

interface FeatureContextMenuProps {
  onOpen: (featureId: string) => void;
  onStatusChange: (featureId: string, status: string) => void;
  onPriorityChange: (featureId: string, priority: string) => void;
  onDelete: (featureId: string) => void;
}

/**
 * Renders a hidden ContextMenu trigger. Call `open(state, event)` from a
 * right-click handler to show the menu at the cursor position.
 */
export function useFeatureContextMenu(props: FeatureContextMenuProps) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<FeatureContextMenuState | null>(null);

  const open = useCallback((state: FeatureContextMenuState, e: React.MouseEvent | MouseEvent) => {
    stateRef.current = state;
    // Dispatch a real contextmenu event on the hidden trigger so Radix
    // captures the coordinates and positions the menu natively.
    const syntheticEvent = new MouseEvent("contextmenu", {
      bubbles: true,
      clientX: e.clientX,
      clientY: e.clientY,
    });
    triggerRef.current?.dispatchEvent(syntheticEvent);
  }, []);

  const menu = (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={triggerRef}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: 0,
            height: 0,
            pointerEvents: "none",
            overflow: "hidden",
          }}
        />
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={() => {
          if (stateRef.current) props.onOpen(stateRef.current.featureId);
        }}>
          <Pencil className="mr-2 h-4 w-4" />
          Open
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <CheckCircle className="mr-2 h-4 w-4" />
            Set Status
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            {Object.entries(statusConfig).map(([key, config]) => {
              const Icon = config.icon;
              return (
                <ContextMenuItem
                  key={key}
                  onClick={() => {
                    if (stateRef.current) props.onStatusChange(stateRef.current.featureId, key);
                  }}
                  className={stateRef.current?.status === key ? "bg-accent text-accent-foreground" : ""}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {config.label}
                </ContextMenuItem>
              );
            })}
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Flag className="mr-2 h-4 w-4" />
            Set Priority
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            {Object.entries(priorityConfig).map(([key, config]) => {
              const Icon = config.icon;
              return (
                <ContextMenuItem
                  key={key}
                  onClick={() => {
                    if (stateRef.current) props.onPriorityChange(stateRef.current.featureId, key);
                  }}
                  className={stateRef.current?.priority === key ? "bg-accent text-accent-foreground" : ""}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {config.label}
                </ContextMenuItem>
              );
            })}
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator />

        <ContextMenuItem
          onClick={() => {
            if (stateRef.current) props.onDelete(stateRef.current.featureId);
          }}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );

  return { open, menu };
}
