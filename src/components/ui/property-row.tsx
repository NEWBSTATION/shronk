"use client";

import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  PropertyRow — Dougly-style polymorphic inline-edit row                     */
/*  Layout: [Icon size-4 mt-0.5] [Label w-32 text-muted-foreground] [Value]   */
/* -------------------------------------------------------------------------- */

interface PropertyRowBaseProps {
  icon?: React.ElementType;
  label: string;
  className?: string;
}

/* Display-only variant */
interface PropertyRowDisplayProps extends PropertyRowBaseProps {
  type?: "display";
  children: ReactNode;
}

/* Text variant */
interface PropertyRowTextProps extends PropertyRowBaseProps {
  type: "text";
  value: string;
  placeholder?: string;
  onSave: (value: string) => void;
}

/* Textarea variant */
interface PropertyRowTextareaProps extends PropertyRowBaseProps {
  type: "textarea";
  value: string;
  placeholder?: string;
  onSave: (value: string) => void;
}

/* Custom (select, date, duration, etc.) — caller renders the interactive element */
interface PropertyRowCustomProps extends PropertyRowBaseProps {
  type: "custom";
  children: ReactNode;
}

type PropertyRowProps =
  | PropertyRowDisplayProps
  | PropertyRowTextProps
  | PropertyRowTextareaProps
  | PropertyRowCustomProps;

export function PropertyRow(props: PropertyRowProps) {
  const { icon: Icon, label, className } = props;

  return (
    <div
      className={cn(
        "flex items-center gap-3 min-h-8 py-1.5 rounded-md px-2 -mx-2",
        className
      )}
    >
      {/* Icon */}
      <div className="shrink-0">
        {Icon ? (
          <Icon className="size-4 text-muted-foreground" />
        ) : (
          <div className="size-4" />
        )}
      </div>

      {/* Label */}
      <span className="w-32 shrink-0 text-muted-foreground text-sm">
        {label}
      </span>

      {/* Value */}
      {(props.type === undefined || props.type === "display") && (
        <div className="flex-1 text-sm">{props.children}</div>
      )}
      {props.type === "text" && <InlineTextInput {...props} />}
      {props.type === "textarea" && <InlineTextarea {...props} />}
      {props.type === "custom" && (
        <div className="flex-1 min-w-0">{props.children}</div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Inline text input                                                          */
/* -------------------------------------------------------------------------- */

function InlineTextInput({
  value,
  placeholder,
  onSave,
}: PropertyRowTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = useCallback(() => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onSave(trimmed);
    } else {
      setDraft(value);
    }
  }, [draft, value, onSave]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className="flex-1 h-8 bg-transparent rounded px-2 py-1.5 -mx-2 -my-1 text-sm leading-normal outline-none ring-1 ring-ring"
        placeholder={placeholder}
      />
    );
  }

  return (
    <div
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className="flex-1 text-sm cursor-pointer rounded px-2 py-1 -mx-2 -my-1 hover:bg-accent/50 transition-colors"
    >
      {value || (
        <span className="text-muted-foreground">{placeholder || "\u2014"}</span>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Inline textarea                                                            */
/* -------------------------------------------------------------------------- */

function InlineTextarea({
  value,
  placeholder,
  onSave,
}: PropertyRowTextareaProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing) {
      textareaRef.current?.focus();
    }
  }, [editing]);

  const commit = useCallback(() => {
    setEditing(false);
    if (draft !== value) {
      onSave(draft);
    }
  }, [draft, value, onSave]);

  if (editing) {
    return (
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            commit();
          }
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        rows={3}
        className="flex-1 bg-transparent rounded px-2 py-1.5 -mx-2 -my-1 text-sm outline-none ring-1 ring-ring resize-none min-h-[60px]"
        placeholder={placeholder}
      />
    );
  }

  return (
    <div
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className="flex-1 text-sm cursor-pointer rounded px-2 py-1 -mx-2 -my-1 hover:bg-accent/50 transition-colors"
    >
      {value ? (
        <span className="line-clamp-3 whitespace-pre-wrap">{value}</span>
      ) : (
        <span className="text-muted-foreground">{placeholder || "\u2014"}</span>
      )}
    </div>
  );
}
