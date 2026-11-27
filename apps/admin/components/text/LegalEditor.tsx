"use client";

// The Notion-style editor for legal pages, set up like the owner's sxingxian and theseahfamily editors. It edits
// Tiptap's document and hands back the saved format (doc-pm.ts), so nothing outside that format can be saved.
import { safeHref, type Doc } from "@astro/copy";
import { mergeAttributes, Node } from "@tiptap/core";
import DragHandle from "@tiptap/extension-drag-handle-react";
import { Placeholder } from "@tiptap/extensions";
import { NodeSelection } from "@tiptap/pm/state";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { useRef } from "react";
import { docToPm, pmToDoc, type PMNode } from "./doc-pm";
import { SlashCommand } from "./legal-slash";

const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "paragraph",
  defining: true,
  parseHTML: () => [{ tag: "aside[data-callout]" }],
  renderHTML: ({ HTMLAttributes }) => ["aside", mergeAttributes(HTMLAttributes, { "data-callout": "", class: "ed-callout" }), 0]
});

export default function LegalEditor({ value, onChange, label }: { value: Doc; onChange: (doc: Doc) => void; label: string }) {
  const changeRef = useRef(onChange);
  changeRef.current = onChange;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        strike: false,
        underline: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https", isAllowedUri: (url) => safeHref(url) !== null }
      }),
      Callout,
      Placeholder.configure({ placeholder: ({ node }) => (node.type.name === "heading" ? "Heading" : "Type '/' for blocks") }),
      SlashCommand
    ],
    editorProps: { attributes: { "aria-label": label, "aria-multiline": "true", role: "textbox" } },
    content: docToPm(value),
    onUpdate: ({ editor: ed }) => changeRef.current(pmToDoc(ed.getJSON() as PMNode))
  });

  if (!editor) return <div className="ed-loading min-h-[320px]" aria-busy="true" />;

  function setLink() {
    if (!editor) return;
    const current = (editor.getAttributes("link") as { href?: string }).href ?? "";
    const href = window.prompt("Link address (https:// or mailto:)", current);
    if (href === null) return;
    const chain = editor.chain().focus().extendMarkRange("link");
    if (href.trim() === "") return void chain.unsetLink().run();
    const safe = safeHref(href);
    if (safe) chain.setLink({ href: safe }).run();
  }

  return (
    <div className="ed-wrap">
      <DragHandle editor={editor}>
        <div className="ed-grip" title="Drag to move" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.7" /><circle cx="15" cy="6" r="1.7" /><circle cx="9" cy="12" r="1.7" /><circle cx="15" cy="12" r="1.7" /><circle cx="9" cy="18" r="1.7" /><circle cx="15" cy="18" r="1.7" /></svg>
        </div>
      </DragHandle>
      <BubbleMenu editor={editor} shouldShow={({ state }) => !state.selection.empty && !(state.selection instanceof NodeSelection)}>
        <div className="ed-bubble" role="toolbar" aria-label="Formatting">
          <button type="button" aria-pressed={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></button>
          <button type="button" aria-pressed={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></button>
          <button type="button" aria-pressed={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
          <button type="button" aria-pressed={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
          <button type="button" aria-pressed={editor.isActive("link")} onClick={setLink}>Link</button>
        </div>
      </BubbleMenu>
      <EditorContent editor={editor} />
    </div>
  );
}
