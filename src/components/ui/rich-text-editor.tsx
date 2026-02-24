"use client";

import { useEffect, useRef, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Link as LinkIcon,
  Quote,
  Code,
  Heading2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Toggle } from "@/components/ui/toggle";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

// Inline SVG helper — used in raw DOM strings
const icon = (d: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

interface SlashCommand {
  label: string;
  action: string;
  icon: string;
}

interface SlashCommandGroup {
  label: string;
  commands: SlashCommand[];
}

const slashCommandGroups: SlashCommandGroup[] = [
  {
    label: "TEXT",
    commands: [
      { label: "Normal Text", action: "paragraph", icon: icon('<path d="M13 4v16"/><path d="M17 4v16"/><path d="M19 4H9.5a4.5 4.5 0 0 0 0 9H13"/>') },
      { label: "Heading 1", action: "heading1", icon: icon('<path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17 12l3-2v8"/>') },
      { label: "Heading 2", action: "heading2", icon: icon('<path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"/>') },
      { label: "Heading 3", action: "heading3", icon: icon('<path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2"/><path d="M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 0 0-2-2"/>') },
      { label: "Heading 4", action: "heading4", icon: icon('<path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17 10v4h4"/><path d="M21 10v8"/>') },
      { label: "Bold", action: "bold", icon: icon('<path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/>') },
      { label: "Italic", action: "italic", icon: icon('<line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/>') },
      { label: "Strikethrough", action: "strike", icon: icon('<path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><line x1="4" x2="20" y1="12" y2="12"/>') },
    ],
  },
  {
    label: "LISTS",
    commands: [
      { label: "Bullet List", action: "bulletList", icon: icon('<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>') },
      { label: "Numbered List", action: "orderedList", icon: icon('<line x1="10" x2="21" y1="6" y2="6"/><line x1="10" x2="21" y1="12" y2="12"/><line x1="10" x2="21" y1="18" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>') },
      { label: "To-do List", action: "taskList", icon: icon('<rect x="3" y="5" width="6" height="6" rx="1"/><path d="m3 17 2 2 4-4"/><line x1="13" x2="21" y1="6" y2="6"/><line x1="13" x2="21" y1="12" y2="12"/><line x1="13" x2="21" y1="18" y2="18"/>') },
    ],
  },
  {
    label: "BLOCKS",
    commands: [
      { label: "Quote", action: "blockquote", icon: icon('<path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/><path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/>') },
      { label: "Code Block", action: "codeBlock", icon: icon('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>') },
      { label: "Divider", action: "horizontalRule", icon: icon('<line x1="2" x2="22" y1="12" y2="12"/>') },
      { label: "Clear Formatting", action: "clearFormatting", icon: icon('<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/><line x1="18" x2="22" y1="19" y2="15"/>') },
    ],
  },
];

const allSlashCommands: SlashCommand[] = slashCommandGroups.flatMap((g) => g.commands);

function executeSlashCommand(editor: Editor, action: string) {
  switch (action) {
    case "paragraph":
      editor.chain().focus().setParagraph().run();
      break;
    case "heading1":
      editor.chain().focus().toggleHeading({ level: 1 }).run();
      break;
    case "heading2":
      editor.chain().focus().toggleHeading({ level: 2 }).run();
      break;
    case "heading3":
      editor.chain().focus().toggleHeading({ level: 3 }).run();
      break;
    case "heading4":
      editor.chain().focus().toggleHeading({ level: 4 }).run();
      break;
    case "bold":
      editor.chain().focus().toggleBold().run();
      break;
    case "italic":
      editor.chain().focus().toggleItalic().run();
      break;
    case "strike":
      editor.chain().focus().toggleStrike().run();
      break;
    case "bulletList":
      editor.chain().focus().toggleBulletList().run();
      break;
    case "orderedList":
      editor.chain().focus().toggleOrderedList().run();
      break;
    case "taskList":
      editor.chain().focus().toggleTaskList().run();
      break;
    case "blockquote":
      editor.chain().focus().toggleBlockquote().run();
      break;
    case "codeBlock":
      editor.chain().focus().toggleCodeBlock().run();
      break;
    case "horizontalRule":
      editor.chain().focus().setHorizontalRule().run();
      break;
    case "clearFormatting":
      editor.chain().focus().clearNodes().unsetAllMarks().run();
      break;
  }
}

/* -------------------------------------------------------------------------- */
/*  Slash menu — built with real DOM elements for reliable event handling      */
/* -------------------------------------------------------------------------- */

/** Refs to every item element so we can restyle without replacing innerHTML */
type MenuItemEl = HTMLDivElement;

function applyItemStyle(el: MenuItemEl, selected: boolean) {
  el.style.background = selected ? "var(--accent)" : "transparent";
  el.style.color = selected ? "var(--accent-foreground)" : "inherit";
}

function buildMenu(
  onSelect: (idx: number) => void,
  onHover: (idx: number) => void,
  itemRefs: MenuItemEl[],
) {
  const frag = document.createDocumentFragment();
  let flatIndex = 0;

  for (const group of slashCommandGroups) {
    const section = document.createElement("div");
    section.style.marginBottom = "4px";

    const label = document.createElement("div");
    Object.assign(label.style, {
      fontSize: "11px", fontWeight: "600", textTransform: "uppercase",
      letterSpacing: "0.05em", padding: "4px 8px",
      color: "var(--muted-foreground)",
    });
    label.textContent = group.label;
    section.appendChild(label);

    const grid = document.createElement("div");
    Object.assign(grid.style, {
      display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px",
    });

    for (const cmd of group.commands) {
      const idx = flatIndex++;
      const item = document.createElement("div") as MenuItemEl;
      Object.assign(item.style, {
        display: "flex", alignItems: "center", gap: "8px",
        borderRadius: "6px", padding: "5px 8px", cursor: "pointer",
        background: "transparent", color: "inherit",
      });

      const iconWrap = document.createElement("span");
      Object.assign(iconWrap.style, {
        flexShrink: "0", display: "flex", alignItems: "center", justifyContent: "center",
        width: "28px", height: "28px", borderRadius: "6px",
        border: "1px solid var(--border)",
        background: "color-mix(in srgb, var(--muted) 50%, transparent)",
        color: "var(--muted-foreground)",
      });
      iconWrap.innerHTML = cmd.icon;

      const labelSpan = document.createElement("span");
      labelSpan.style.fontSize = "13px";
      labelSpan.textContent = cmd.label;

      item.appendChild(iconWrap);
      item.appendChild(labelSpan);

      item.addEventListener("pointerenter", () => {
        for (let i = 0; i < itemRefs.length; i++) applyItemStyle(itemRefs[i], i === idx);
        onHover(idx);
      });
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        onSelect(idx);
      });

      itemRefs.push(item);
      grid.appendChild(item);
    }

    section.appendChild(grid);
    frag.appendChild(section);
  }

  return frag;
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = "Write or type / for commands",
  className,
}: RichTextEditorProps) {
  const editorRef = useRef<Editor | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const selectedIndexRef = useRef(0);
  const itemRefsRef = useRef<MenuItemEl[]>([]);
  const dragHandleRef = useRef<HTMLDivElement>(null);
  const addButtonRef = useRef<HTMLDivElement>(null);
  const hoveredBlockRef = useRef<{ pos: number; dom: HTMLElement; empty: boolean } | null>(null);

  const cleanupSlashMenu = useCallback(() => {
    menuRef.current?.remove();
    menuRef.current = null;
    itemRefsRef.current = [];
  }, []);

  const showSlashMenu = useCallback(
    (view: { coordsAtPos: (pos: number) => { top: number; bottom: number; left: number } }, from: number) => {
      cleanupSlashMenu();

      const menu = document.createElement("div");
      menu.setAttribute("data-floating-menu", "");
      const isMobile = window.innerWidth < 640;
      Object.assign(menu.style, {
        position: "fixed",
        zIndex: "50",
        width: isMobile ? `${window.innerWidth - 16}px` : "360px",
        maxHeight: "min(400px, 60vh)",
        overflowY: "auto",
        borderRadius: "8px",
        border: "1px solid var(--border)",
        background: "var(--popover)",
        color: "var(--popover-foreground)",
        padding: "6px",
        boxShadow: "0 4px 24px rgba(0,0,0,.12), 0 1px 4px rgba(0,0,0,.08)",
      });
      menuRef.current = menu;
      selectedIndexRef.current = 0;

      const items: MenuItemEl[] = [];
      const onSelect = (idx: number) => {
        const editor = editorRef.current;
        if (!editor) return;
        // Defer so the menu stays in the DOM during all pointer events,
        // preventing the drilldown click-outside handler from misidentifying
        // the click as outside the panel.
        requestAnimationFrame(() => {
          cleanupSlashMenu();
          editor.chain().focus().deleteRange({ from: from - 1, to: from }).run();
          executeSlashCommand(editor, allSlashCommands[idx].action);
        });
      };
      const onHover = (idx: number) => { selectedIndexRef.current = idx; };

      const frag = buildMenu(onSelect, onHover, items);
      itemRefsRef.current = items;
      menu.appendChild(frag);

      // Highlight the first item
      if (items.length > 0) applyItemStyle(items[0], true);

      const coords = view.coordsAtPos(from);
      document.body.appendChild(menu);

      // Clamp position so the menu stays within the viewport
      const rect = menu.getBoundingClientRect();
      let top = coords.bottom + 4;
      let left: number;

      if (isMobile) {
        // Center horizontally on mobile
        left = 8;
      } else {
        left = coords.left;
        if (left + rect.width > window.innerWidth) {
          left = window.innerWidth - rect.width - 8;
        }
        if (left < 8) left = 8;
      }

      if (top + rect.height > window.innerHeight) {
        top = coords.top - rect.height - 4;
      }

      menu.style.top = `${top}px`;
      menu.style.left = `${left}px`;
    },
    [cleanupSlashMenu],
  );

  // Global keydown handler for slash menu navigation
  useEffect(() => {
    function updateSelection(newIdx: number) {
      const items = itemRefsRef.current;
      for (let i = 0; i < items.length; i++) applyItemStyle(items[i], i === newIdx);
      selectedIndexRef.current = newIdx;
      // Scroll selected item into view within the menu
      items[newIdx]?.scrollIntoView({ block: "nearest" });
    }

    function handleKeydown(e: KeyboardEvent) {
      if (!menuRef.current || !editorRef.current) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        updateSelection((selectedIndexRef.current + 1) % allSlashCommands.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        updateSelection(
          (selectedIndexRef.current - 1 + allSlashCommands.length) % allSlashCommands.length
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        const editor = editorRef.current;
        const idx = selectedIndexRef.current;
        const { from } = editor.state.selection;
        cleanupSlashMenu();
        editor.chain().focus().deleteRange({ from: from - 1, to: from }).run();
        executeSlashCommand(editor, allSlashCommands[idx].action);
      } else if (e.key === "Escape") {
        e.preventDefault();
        cleanupSlashMenu();
      } else {
        cleanupSlashMenu();
      }
    }

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        cleanupSlashMenu();
      }
    }

    document.addEventListener("keydown", handleKeydown, true);
    document.addEventListener("mousedown", handleClickOutside, true);
    return () => {
      document.removeEventListener("keydown", handleKeydown, true);
      document.removeEventListener("mousedown", handleClickOutside, true);
      cleanupSlashMenu();
    };
  }, [cleanupSlashMenu]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
        link: false,
        underline: false,
      }),
      Placeholder.configure({ placeholder, showOnlyCurrent: true }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-primary underline cursor-pointer" },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content,
    onUpdate: ({ editor: e }) => {
      const html = e.getHTML();
      onChange(html === "<p></p>" ? "" : html);
    },
    editorProps: {
      attributes: {
        class:
          "tiptap prose prose-sm dark:prose-invert max-w-none outline-none min-h-[120px] pl-8 pr-8 pt-6 pb-8 text-sm [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_blockquote]:my-1 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-1 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_h4]:text-sm [&_h4]:font-medium [&_h4]:mt-2 [&_h4]:mb-1 [&_h4]:text-muted-foreground [&_code]:bg-muted [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_pre]:bg-muted [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:text-xs [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground/30 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_hr]:border-border [&_hr]:my-3",
      },
      handleKeyDown: (view, event) => {
        if (event.key !== "/") return false;
        const { $from } = view.state.selection;
        if ($from.parent.textContent !== "") return false;
        // Defer so the "/" is inserted first
        const from = view.state.selection.from + 1; // +1 because "/" will be inserted
        setTimeout(() => showSlashMenu(view, from), 0);
        return false;
      },
    },
  });

  // Keep ref in sync
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Sync external content changes (e.g. switching between features)
  useEffect(() => {
    if (!editor) return;
    const currentHtml = editor.getHTML();
    const normalized = currentHtml === "<p></p>" ? "" : currentHtml;
    if (content !== normalized) {
      editor.commands.setContent(content || "");
    }
  }, [content, editor]);

  // Drag handle + add button — position in the left padding on block hover
  useEffect(() => {
    if (!editor) return;
    const editorEl = editor.view.dom;
    const handle = dragHandleRef.current;
    const addBtn = addButtonRef.current;
    if (!handle || !addBtn) return;

    let currentBlockDom: HTMLElement | null = null;

    const showElement = (el: HTMLElement, blockDom: HTMLElement) => {
      const wrapperEl = el.parentElement;
      if (!wrapperEl) return;
      const wrapperRect = wrapperEl.getBoundingClientRect();
      const blockRect = blockDom.getBoundingClientRect();
      const elHeight = el.offsetHeight || 18;
      el.style.display = "flex";
      el.style.top = `${blockRect.top - wrapperRect.top + (blockRect.height - elHeight) / 2 - 1}px`;
      el.style.opacity = "0.7";
    };

    const hideAll = () => {
      handle.style.display = "none";
      handle.style.opacity = "0";
      addBtn.style.display = "none";
      addBtn.style.opacity = "0";
      hoveredBlockRef.current = null;
      currentBlockDom = null;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const { doc } = editor.state;
      let found = false;
      doc.forEach((node, offset) => {
        if (found) return;
        const domNode = editor.view.nodeDOM(offset);
        if (!(domNode instanceof HTMLElement)) return;
        const rect = domNode.getBoundingClientRect();
        if (e.clientY < rect.top || e.clientY > rect.bottom) return;

        found = true;
        const isTextBlock = node.type.name === "paragraph" || node.type.name === "heading";
        const isEmpty = isTextBlock && node.textContent.length === 0;

        if (currentBlockDom !== domNode) {
          currentBlockDom = domNode;
          hoveredBlockRef.current = { pos: offset, dom: domNode, empty: isEmpty };
          if (isEmpty) {
            handle.style.display = "none";
            handle.style.opacity = "0";
            showElement(addBtn, domNode);
          } else {
            addBtn.style.display = "none";
            addBtn.style.opacity = "0";
            showElement(handle, domNode);
          }
        }
      });
      if (!found) hideAll();
    };

    const handleMouseLeave = (e: MouseEvent) => {
      const related = e.relatedTarget as HTMLElement | null;
      if (related && (handle.contains(related) || addBtn.contains(related))) return;
      hideAll();
    };

    const handleElMouseLeave = (e: MouseEvent) => {
      const related = e.relatedTarget as HTMLElement | null;
      if (related && editorEl.contains(related)) return;
      hideAll();
    };

    const handleElMouseEnter = (e: MouseEvent) => {
      (e.currentTarget as HTMLElement).style.opacity = "1";
    };

    editorEl.addEventListener("mousemove", handleMouseMove);
    editorEl.addEventListener("mouseleave", handleMouseLeave);
    for (const el of [handle, addBtn]) {
      el.addEventListener("mouseleave", handleElMouseLeave);
      el.addEventListener("mouseenter", handleElMouseEnter);
    }

    return () => {
      editorEl.removeEventListener("mousemove", handleMouseMove);
      editorEl.removeEventListener("mouseleave", handleMouseLeave);
      for (const el of [handle, addBtn]) {
        el.removeEventListener("mouseleave", handleElMouseLeave);
        el.removeEventListener("mouseenter", handleElMouseEnter);
      }
    };
  }, [editor]);

  const handleAddClick = useCallback(() => {
    if (!editor || !hoveredBlockRef.current) return;
    const { pos } = hoveredBlockRef.current;
    // Place cursor inside the empty block and insert "/"
    editor.chain().focus().setTextSelection(pos + 1).insertContent("/").run();
    // Trigger slash menu at the cursor position (after the "/")
    const from = editor.state.selection.from;
    showSlashMenu(editor.view, from);
  }, [editor, showSlashMenu]);

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      if (!editor || !hoveredBlockRef.current) {
        e.preventDefault();
        return;
      }
      const { pos, dom: blockDom } = hoveredBlockRef.current;
      const { view } = editor;

      // Select the node so ProseMirror knows what's being dragged
      const sel = NodeSelection.create(view.state.doc, pos);
      view.dispatch(view.state.tr.setSelection(sel));

      // Serialize the block for the drag data transfer
      const slice = sel.content();
      const { dom, text } = view.serializeForClipboard(slice);
      e.dataTransfer.setData("text/html", dom.innerHTML);
      e.dataTransfer.setData("text/plain", text);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setDragImage(blockDom, 0, 0);

      // Tell ProseMirror a drag is in progress
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (view as any).dragging = { slice, move: true };
    },
    [editor],
  );

  if (!editor) return null;

  return (
    <div className={cn("relative rounded-lg border border-border bg-background overflow-hidden", className)}>
      {/* Drag handle — grip dots for content blocks */}
      <div
        ref={dragHandleRef}
        draggable
        onDragStart={handleDragStart}
        className="absolute left-[10px] z-10 w-[18px] h-[18px] items-center justify-center rounded-[4px] cursor-grab hover:bg-accent"
        style={{ display: "none", opacity: 0, transition: "top 0.15s ease, opacity 0.15s ease" }}
      >
        <svg width="10" height="14" viewBox="0 0 10 14" className="text-foreground/70" fill="currentColor">
          <circle cx="3" cy="2" r="1.2" />
          <circle cx="7" cy="2" r="1.2" />
          <circle cx="3" cy="7" r="1.2" />
          <circle cx="7" cy="7" r="1.2" />
          <circle cx="3" cy="12" r="1.2" />
          <circle cx="7" cy="12" r="1.2" />
        </svg>
      </div>
      {/* Add button — "+" for empty blocks, opens slash menu */}
      <div
        ref={addButtonRef}
        onClick={handleAddClick}
        className="absolute left-[10px] z-10 w-[18px] h-[18px] items-center justify-center rounded-[4px] cursor-pointer hover:bg-accent"
        style={{ display: "none", opacity: 0, transition: "top 0.15s ease, opacity 0.15s ease" }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="text-foreground/70">
          <line x1="6" y1="1.5" x2="6" y2="10.5" />
          <line x1="1.5" y1="6" x2="10.5" y2="6" />
        </svg>
      </div>
      {/* Bubble menu — appears on text selection */}
      <BubbleMenu
        editor={editor}
        className="flex items-center gap-0.5 rounded-lg border bg-background p-1 shadow-md"
      >
        <BubbleToggle
          pressed={editor.isActive("bold")}
          onPressedChange={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <Bold className="h-3.5 w-3.5" />
        </BubbleToggle>
        <BubbleToggle
          pressed={editor.isActive("italic")}
          onPressedChange={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <Italic className="h-3.5 w-3.5" />
        </BubbleToggle>
        <BubbleToggle
          pressed={editor.isActive("underline")}
          onPressedChange={() =>
            editor.chain().focus().toggleUnderline().run()
          }
          title="Underline"
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </BubbleToggle>
        <BubbleToggle
          pressed={editor.isActive("strike")}
          onPressedChange={() => editor.chain().focus().toggleStrike().run()}
          title="Strikethrough"
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </BubbleToggle>

        <div className="w-px h-4 bg-border mx-0.5" />

        <BubbleToggle
          pressed={editor.isActive("heading", { level: 2 })}
          onPressedChange={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          title="Heading"
        >
          <Heading2 className="h-3.5 w-3.5" />
        </BubbleToggle>
        <BubbleToggle
          pressed={editor.isActive("bulletList")}
          onPressedChange={() =>
            editor.chain().focus().toggleBulletList().run()
          }
          title="Bullet list"
        >
          <List className="h-3.5 w-3.5" />
        </BubbleToggle>
        <BubbleToggle
          pressed={editor.isActive("orderedList")}
          onPressedChange={() =>
            editor.chain().focus().toggleOrderedList().run()
          }
          title="Numbered list"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </BubbleToggle>

        <div className="w-px h-4 bg-border mx-0.5" />

        <BubbleToggle
          pressed={editor.isActive("blockquote")}
          onPressedChange={() =>
            editor.chain().focus().toggleBlockquote().run()
          }
          title="Quote"
        >
          <Quote className="h-3.5 w-3.5" />
        </BubbleToggle>
        <BubbleToggle
          pressed={editor.isActive("codeBlock")}
          onPressedChange={() =>
            editor.chain().focus().toggleCodeBlock().run()
          }
          title="Code block"
        >
          <Code className="h-3.5 w-3.5" />
        </BubbleToggle>
        <BubbleToggle
          pressed={editor.isActive("link")}
          onPressedChange={() => {
            if (editor.isActive("link")) {
              editor.chain().focus().unsetLink().run();
            } else {
              const url = window.prompt("URL:");
              if (url) {
                editor.chain().focus().setLink({ href: url }).run();
              }
            }
          }}
          title="Link"
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </BubbleToggle>
      </BubbleMenu>

      <EditorContent editor={editor} />
    </div>
  );
}

function BubbleToggle({
  children,
  pressed,
  onPressedChange,
  title,
}: {
  children: React.ReactNode;
  pressed: boolean;
  onPressedChange: () => void;
  title: string;
}) {
  return (
    <Toggle
      size="sm"
      pressed={pressed}
      onPressedChange={onPressedChange}
      title={title}
      className="h-7 w-7 p-0 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
    >
      {children}
    </Toggle>
  );
}
