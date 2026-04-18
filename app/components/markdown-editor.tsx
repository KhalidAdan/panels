"use client";

import { Button } from "#app/components/ui/button";
import { cn } from "#app/lib/misc";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useState } from "react";

interface MarkdownEditorProps {
  name: string;
  defaultValue?: string;
  label?: string;
  placeholder?: string;
  errors?: string[];
}

export function MarkdownEditor({
  name,
  defaultValue = "",
  label,
  placeholder = "Write something...",
  errors,
}: MarkdownEditorProps) {
  const [preview, setPreview] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-blue-500 underline",
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: defaultValue,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm prose-p:mb-1 max-w-none focus:outline-none min-h-[150px] p-3",
      },
    },
  });

  const addLink = useCallback(() => {
    const url = window.prompt("Enter URL:");
    if (url) {
      editor?.chain().focus().setLink({ href: url }).run();
    }
  }, [editor]);

  const id = `markdown-${name}`;
  const errorId = errors?.length ? `${id}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">{label}</label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setPreview(!preview)}
          >
            {preview ? "Edit" : "Preview"}
          </Button>
        </div>
      )}

      {preview ? (
        <div
          className={cn(
            "min-h-[150px] rounded-md border border-input bg-background p-3 text-sm",
            errors?.length && "border-destructive",
          )}
          dangerouslySetInnerHTML={{
            __html: editor?.getHTML() || "",
          }}
        />
      ) : (
        <>
          <div
            className={cn(
              "rounded-md border border-input bg-background",
              errors?.length && "border-destructive",
            )}
          >
            <div className="flex flex-wrap items-center gap-1 border-b border-border p-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => editor?.chain().focus().toggleBold().run()}
              >
                <span className="font-bold">B</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => editor?.chain().focus().toggleItalic().run()}
              >
                <span className="italic">I</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => editor?.chain().focus().toggleStrike().run()}
              >
                <span className="line-through">S</span>
              </Button>
              <div className="h-4 w-px bg-border" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() =>
                  editor?.chain().focus().toggleHeading({ level: 2 }).run()
                }
              >
                H2
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() =>
                  editor?.chain().focus().toggleHeading({ level: 3 }).run()
                }
              >
                H3
              </Button>
              <div className="h-4 w-px bg-border" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
              >
                • List
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() =>
                  editor?.chain().focus().toggleOrderedList().run()
                }
              >
                1. List
              </Button>
              <div className="h-4 w-px bg-border" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={addLink}
              >
                Link
              </Button>
            </div>
            <EditorContent editor={editor} />
          </div>
          <input type="hidden" name={name} value={editor?.getHTML() || ""} />
        </>
      )}

      <div className="min-h-[20px]">
        {errorId && errors?.length ? (
          <ul id={errorId} className="flex flex-col gap-1">
            {errors.map((e, i) => (
              <li key={i} className="text-sm text-destructive">
                {e}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        Use the toolbar for formatting, or markdown shortcuts like **bold** and
        *italic*
      </p>
    </div>
  );
}
