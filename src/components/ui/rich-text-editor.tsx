"use client";

import { useEffect, useRef, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
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

const iconSvg = (d: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

const slashCommandGroups = [
  {
    label: "TEXT",
    commands: [
      { label: "Heading 2", action: "heading2", icon: iconSvg('<path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"/>') },
      { label: "Heading 3", action: "heading3", icon: iconSvg('<path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2"/><path d="M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 0 0-2-2"/>') },
      { label: "Bullet List", action: "bulletList", icon: iconSvg('<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>') },
      { label: "Numbered List", action: "orderedList", icon: iconSvg('<line x1="10" x2="21" y1="6" y2="6"/><line x1="10" x2="21" y1="12" y2="12"/><line x1="10" x2="21" y1="18" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>') },
      { label: "Quote", action: "blockquote", icon: iconSvg('<path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/><path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/>') },
      { label: "Code Block", action: "codeBlock", icon: iconSvg('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>') },
    ],
  },
] as const;

const allSlashCommands = slashCommandGroups.flatMap((g) => g.commands);

function executeSlashCommand(editor: Editor, action: string) {
  switch (action) {
    case "heading2":
      editor.chain().focus().toggleHeading({ level: 2 }).run();
      break;
    case "heading3":
      editor.chain().focus().toggleHeading({ level: 3 }).run();
      break;
    case "bulletList":
      editor.chain().focus().toggleBulletList().run();
      break;
    case "orderedList":
      editor.chain().focus().toggleOrderedList().run();
      break;
    case "blockquote":
      editor.chain().focus().toggleBlockquote().run();
      break;
    case "codeBlock":
      editor.chain().focus().toggleCodeBlock().run();
      break;
  }
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

  const cleanupSlashMenu = useCallback(() => {
    menuRef.current?.remove();
    menuRef.current = null;
  }, []);

  const renderSlashMenu = useCallback((menu: HTMLDivElement, selectedIndex: number) => {
    let flatIndex = 0;
    menu.innerHTML = slashCommandGroups
      .map(
        (group) => {
          const items = group.commands
            .map((cmd) => {
              const idx = flatIndex++;
              return `<div class="flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer ${idx === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent"}" data-index="${idx}">
                <span class="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-md border border-border bg-muted/50 text-muted-foreground">${cmd.icon}</span>
                <span class="text-sm">${cmd.label}</span>
              </div>`;
            })
            .join("");
          return `<div class="mb-1">
            <div class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">${group.label}</div>
            <div class="grid grid-cols-2 gap-0.5">${items}</div>
          </div>`;
        },
      )
      .join("");
  }, []);

  const showSlashMenu = useCallback(
    (view: { coordsAtPos: (pos: number) => { top: number; bottom: number; left: number } }, from: number) => {
      cleanupSlashMenu();

      const menu = document.createElement("div");
      menu.className =
        "fixed z-50 w-[340px] rounded-lg border bg-popover p-1.5 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95";
      menuRef.current = menu;
      selectedIndexRef.current = 0;

      renderSlashMenu(menu, 0);

      menu.addEventListener("click", (e) => {
        const target = (e.target as HTMLElement).closest("[data-index]") as HTMLElement | null;
        if (target && editorRef.current) {
          const idx = Number(target.dataset.index);
          const editor = editorRef.current;
          cleanupSlashMenu();
          // Delete the "/" character then execute the command
          editor.chain().focus().deleteRange({ from: from - 1, to: from }).run();
          executeSlashCommand(editor, allSlashCommands[idx].action);
        }
      });

      const coords = view.coordsAtPos(from);
      document.body.appendChild(menu);

      // Clamp position so the menu stays within the viewport
      const rect = menu.getBoundingClientRect();
      let top = coords.bottom + 4;
      let left = coords.left;

      if (top + rect.height > window.innerHeight) {
        top = coords.top - rect.height - 4;
      }
      if (left + rect.width > window.innerWidth) {
        left = window.innerWidth - rect.width - 8;
      }
      if (left < 8) left = 8;

      menu.style.top = `${top}px`;
      menu.style.left = `${left}px`;
    },
    [cleanupSlashMenu, renderSlashMenu],
  );

  // Global keydown handler for slash menu navigation
  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (!menuRef.current || !editorRef.current) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectedIndexRef.current = (selectedIndexRef.current + 1) % allSlashCommands.length;
        renderSlashMenu(menuRef.current, selectedIndexRef.current);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedIndexRef.current =
          (selectedIndexRef.current - 1 + allSlashCommands.length) % allSlashCommands.length;
        renderSlashMenu(menuRef.current, selectedIndexRef.current);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const editor = editorRef.current;
        const idx = selectedIndexRef.current;
        const { from } = editor.state.selection;
        cleanupSlashMenu();
        // Delete the "/" then run the command
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
  }, [cleanupSlashMenu, renderSlashMenu]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
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
    ],
    content,
    onUpdate: ({ editor: e }) => {
      const html = e.getHTML();
      onChange(html === "<p></p>" ? "" : html);
    },
    editorProps: {
      attributes: {
        class:
          "tiptap prose prose-sm dark:prose-invert max-w-none outline-none min-h-[120px] px-3 py-2.5 text-sm [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_blockquote]:my-1 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_code]:bg-muted [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_pre]:bg-muted [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:text-xs [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground/30 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground",
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

  if (!editor) return null;

  return (
    <div className={cn("rounded-lg border border-border bg-background overflow-hidden", className)}>
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
