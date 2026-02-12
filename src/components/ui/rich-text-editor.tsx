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

const slashCommands = [
  { label: "Heading", description: "Large section heading", action: "heading" },
  { label: "Bullet List", description: "Simple bullet list", action: "bulletList" },
  { label: "Numbered List", description: "Numbered list", action: "orderedList" },
  { label: "Quote", description: "Block quote", action: "blockquote" },
  { label: "Code Block", description: "Code snippet", action: "codeBlock" },
] as const;

function executeSlashCommand(editor: Editor, action: string) {
  switch (action) {
    case "heading":
      editor.chain().focus().toggleHeading({ level: 2 }).run();
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
    menu.innerHTML = slashCommands
      .map(
        (cmd, i) =>
          `<div class="flex flex-col gap-0.5 rounded-md px-2 py-1.5 text-sm cursor-pointer ${i === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent"}" data-index="${i}">
            <span class="font-medium">${cmd.label}</span>
            <span class="text-xs text-muted-foreground">${cmd.description}</span>
          </div>`,
      )
      .join("");
  }, []);

  const showSlashMenu = useCallback(
    (view: { coordsAtPos: (pos: number) => { top: number; bottom: number; left: number } }, from: number) => {
      cleanupSlashMenu();

      const menu = document.createElement("div");
      menu.className =
        "fixed z-50 min-w-[180px] rounded-lg border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95";
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
          executeSlashCommand(editor, slashCommands[idx].action);
        }
      });

      const coords = view.coordsAtPos(from);
      menu.style.top = `${coords.bottom + 4}px`;
      menu.style.left = `${coords.left}px`;
      document.body.appendChild(menu);
    },
    [cleanupSlashMenu, renderSlashMenu],
  );

  // Global keydown handler for slash menu navigation
  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (!menuRef.current || !editorRef.current) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectedIndexRef.current = (selectedIndexRef.current + 1) % slashCommands.length;
        renderSlashMenu(menuRef.current, selectedIndexRef.current);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedIndexRef.current =
          (selectedIndexRef.current - 1 + slashCommands.length) % slashCommands.length;
        renderSlashMenu(menuRef.current, selectedIndexRef.current);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const editor = editorRef.current;
        const idx = selectedIndexRef.current;
        const { from } = editor.state.selection;
        cleanupSlashMenu();
        // Delete the "/" then run the command
        editor.chain().focus().deleteRange({ from: from - 1, to: from }).run();
        executeSlashCommand(editor, slashCommands[idx].action);
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
      Placeholder.configure({ placeholder, showOnlyCurrent: false }),
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
