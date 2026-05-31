"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Image } from "@tiptap/extension-image";
import { Link } from "@tiptap/extension-link";
import { Underline } from "@tiptap/extension-underline";
import { Highlight } from "@tiptap/extension-highlight";
import { Typography } from "@tiptap/extension-typography";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { FontFamily } from "@tiptap/extension-font-family";
import { TextAlign } from "@tiptap/extension-text-align";
import { useEffect, useCallback } from "react";
import { Bold, Italic, List, Heading1, Heading2, Quote, Link as LinkIcon, Image as ImageIcon, Highlighter, Underline as UnderlineIcon, AlignLeft, AlignCenter, AlignRight, Palette, Type, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface EditorProps {
  content: string;
  onChange: (content: string) => void;
  onSave?: () => void;
}

export function Editor({ content, onChange, onSave }: EditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: "Write your thoughts...",
      }),
      Image,
      Highlight,
      Typography,
      TextStyle,
      Color,
      FontFamily,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    content: content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-zinc dark:prose-invert max-w-none focus:outline-none min-h-[500px] text-lg leading-relaxed",
      },
    },
  });

  // Sync content from prop if it changes externally
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  // Handle auto-saving or manual save triggers
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onSave) onSave();
    }, 2000);
    return () => clearTimeout(timer);
  }, [content, onSave]);

  if (!editor) {
    return null;
  }

  return (
    <div className="relative w-full">
      {editor && (
        <BubbleMenu editor={editor} className="flex flex-wrap items-center gap-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-1 shadow-2xl z-50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={editor.isActive("bold") ? "text-zinc-900 bg-zinc-100 dark:text-zinc-50 dark:bg-zinc-800" : "text-zinc-400"}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={editor.isActive("italic") ? "text-zinc-900 bg-zinc-100 dark:text-zinc-50 dark:bg-zinc-800" : "text-zinc-400"}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={editor.isActive("underline") ? "text-zinc-900 bg-zinc-100 dark:text-zinc-50 dark:bg-zinc-800" : "text-zinc-400"}
          >
            <UnderlineIcon className="h-4 w-4" />
          </Button>
          
          <Separator orientation="vertical" className="h-4 bg-zinc-200 dark:bg-zinc-800 mx-1" />
          
          <Popover>
            <PopoverTrigger className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-zinc-400")}>
              <Palette className="h-4 w-4" />
            </PopoverTrigger>
            <PopoverContent className="w-40 p-2 rounded-xl border-zinc-200 dark:border-zinc-800 shadow-xl" side="top">
              <div className="grid grid-cols-4 gap-1">
                {["#000000", "#666666", "#ef4444", "#f97316", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6"].map((color) => (
                  <button
                    key={color}
                    type="button"
                    className="h-6 w-6 rounded-md border border-zinc-200 dark:border-zinc-800"
                    style={{ backgroundColor: color }}
                    onClick={() => editor.chain().focus().setColor(color).run()}
                  />
                ))}
                <button
                   type="button"
                   className="h-6 w-6 rounded-md border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-[10px]"
                   onClick={() => editor.chain().focus().unsetColor().run()}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-zinc-400")}>
              <Type className="h-4 w-4" />
            </PopoverTrigger>
            <PopoverContent className="w-40 p-2 rounded-xl border-zinc-200 dark:border-zinc-800 shadow-xl" side="top">
              <div className="space-y-1">
                <Button variant="ghost" size="sm" className="w-full justify-start text-xs font-sans" onClick={() => editor.chain().focus().setFontFamily("var(--font-sans)").run()}>Sans</Button>
                <Button variant="ghost" size="sm" className="w-full justify-start text-xs font-inter" onClick={() => editor.chain().focus().setFontFamily("var(--font-inter)").run()}>Inter</Button>
                <Button variant="ghost" size="sm" className="w-full justify-start text-xs font-serif" onClick={() => editor.chain().focus().setFontFamily("var(--font-serif)").run()}>Serif</Button>
                <Button variant="ghost" size="sm" className="w-full justify-start text-xs font-mono" onClick={() => editor.chain().focus().setFontFamily("var(--font-geist-mono)").run()}>Mono</Button>
                <Button variant="ghost" size="sm" className="w-full justify-start text-xs font-display" onClick={() => editor.chain().focus().setFontFamily("var(--font-display)").run()}>Display</Button>
              </div>
            </PopoverContent>
          </Popover>

          <Separator orientation="vertical" className="h-4 bg-zinc-200 dark:bg-zinc-800 mx-1" />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            className={editor.isActive({ textAlign: "left" }) ? "text-zinc-900 bg-zinc-100 dark:text-zinc-50 dark:bg-zinc-800" : "text-zinc-400"}
          >
            <AlignLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            className={editor.isActive({ textAlign: "center" }) ? "text-zinc-900 bg-zinc-100 dark:text-zinc-50 dark:bg-zinc-800" : "text-zinc-400"}
          >
            <AlignCenter className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            className={editor.isActive({ textAlign: "right" }) ? "text-zinc-900 bg-zinc-100 dark:text-zinc-50 dark:bg-zinc-800" : "text-zinc-400"}
          >
            <AlignRight className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-4 bg-zinc-200 dark:bg-zinc-800 mx-1" />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={editor.isActive("heading", { level: 1 }) ? "text-zinc-900 bg-zinc-100 dark:text-zinc-50 dark:bg-zinc-800" : "text-zinc-400"}
          >
            <Heading1 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={editor.isActive("heading", { level: 2 }) ? "text-zinc-900 bg-zinc-100 dark:text-zinc-50 dark:bg-zinc-800" : "text-zinc-400"}
          >
            <Heading2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={editor.isActive("bulletList") ? "text-zinc-900 bg-zinc-100 dark:text-zinc-50 dark:bg-zinc-800" : "text-zinc-400"}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={editor.isActive("blockquote") ? "text-zinc-900 bg-zinc-100 dark:text-zinc-50 dark:bg-zinc-800" : "text-zinc-400"}
          >
            <Quote className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            className={editor.isActive("highlight") ? "text-zinc-900 bg-zinc-100 dark:text-zinc-50 dark:bg-zinc-800" : "text-zinc-400"}
          >
            <Highlighter className="h-4 w-4" />
          </Button>
        </BubbleMenu>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
