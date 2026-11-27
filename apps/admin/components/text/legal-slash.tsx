"use client";

// The "/" block menu, Notion style (as in the owner's sxingxian editor), limited to the blocks a legal page can hold.
import { Extension, type Editor, type Range } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from "@tiptap/suggestion";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";

interface Item {
  title: string;
  hint: string;
  icon: string;
  keywords: string;
  run: (editor: Editor, range: Range) => void;
}

export const ITEMS: Item[] = [
  { title: "Text", hint: "Plain paragraph", icon: "¶", keywords: "paragraph text", run: (e, r) => e.chain().focus().deleteRange(r).setParagraph().run() },
  { title: "Heading", hint: "Section heading", icon: "H2", keywords: "h2 heading title ##", run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 2 }).run() },
  { title: "Subheading", hint: "Smaller heading", icon: "H3", keywords: "h3 subheading ###", run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 3 }).run() },
  { title: "Bulleted list", hint: "Simple list", icon: "•", keywords: "bullet unordered list ul", run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run() },
  { title: "Numbered list", hint: "Ordered list", icon: "1.", keywords: "numbered ordered list ol steps", run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run() },
  { title: "Quote", hint: "Pull quote", icon: "“", keywords: "quote blockquote", run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run() },
  { title: "Callout", hint: "Highlighted note", icon: "!", keywords: "callout note info important", run: (e, r) => e.chain().focus().deleteRange(r).insertContent({ type: "callout", content: [{ type: "paragraph" }] }).run() },
  { title: "Divider", hint: "Horizontal line", icon: "—", keywords: "divider hr line rule", run: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run() }
];

interface MenuRef {
  onKeyDown: (p: SuggestionKeyDownProps) => boolean;
}

const Menu = forwardRef<MenuRef, SuggestionProps<Item>>(function Menu(props, ref) {
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [props.items]);
  const choose = (i: number) => {
    const item = props.items[i];
    if (item) props.command(item);
  };
  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      const n = Math.max(props.items.length, 1);
      if (event.key === "ArrowDown") { setIndex((i) => (i + 1) % n); return true; }
      if (event.key === "ArrowUp") { setIndex((i) => (i - 1 + n) % n); return true; }
      if (event.key === "Enter") { choose(index); return true; }
      return false;
    }
  }));
  if (props.items.length === 0) return <div className="ed-menu"><p className="ed-menu-empty">No matches</p></div>;
  return (
    <div className="ed-menu" role="listbox" aria-label="Insert block">
      {props.items.map((item, i) => (
        <button key={item.title} type="button" role="option" aria-selected={i === index} onMouseEnter={() => setIndex(i)} onMouseDown={(e) => { e.preventDefault(); choose(i); }}>
          <span className="ed-ico" aria-hidden="true">{item.icon}</span>
          <span><span className="ed-t">{item.title}</span><span className="ed-d">{item.hint}</span></span>
        </button>
      ))}
    </div>
  );
});

const MENU_W = 280;
const EDGE = 8;

/** Puts the menu by the caret, inside the visible part of the page (phones' keyboards included). */
function place(el: HTMLElement, rect: (() => DOMRect | null) | null | undefined) {
  const r = rect?.();
  if (!r) return;
  const vv = window.visualViewport;
  const width = vv ? vv.width : window.innerWidth;
  const bottom = (vv ? vv.offsetTop + vv.height : window.innerHeight) - EDGE;
  const below = bottom - r.bottom > 240;
  el.style.position = "fixed";
  el.style.zIndex = "1000";
  el.style.width = `${Math.min(MENU_W, width - EDGE * 2)}px`;
  el.style.left = `${Math.max(EDGE, Math.min(r.left, width - MENU_W - EDGE))}px`;
  el.style.top = `${below ? r.bottom + 6 : r.top - 6}px`;
  el.style.transform = below ? "" : "translateY(-100%)";
}

export const SlashCommand = Extension.create({
  name: "slashCommand",
  addProseMirrorPlugins() {
    return [
      Suggestion<Item, Item>({
        editor: this.editor,
        char: "/",
        items: ({ query }) => {
          const q = query.toLowerCase().trim();
          return q ? ITEMS.filter((i) => i.title.toLowerCase().includes(q) || i.keywords.includes(q)) : ITEMS;
        },
        command: ({ editor, range, props }) => props.run(editor, range),
        render: () => {
          let comp: ReactRenderer<MenuRef, SuggestionProps<Item>> | null = null;
          return {
            onStart: (props) => {
              comp = new ReactRenderer(Menu, { props, editor: props.editor });
              document.body.appendChild(comp.element);
              place(comp.element as HTMLElement, props.clientRect);
            },
            onUpdate: (props) => {
              comp?.updateProps(props);
              if (comp) place(comp.element as HTMLElement, props.clientRect);
            },
            onKeyDown: (props) => {
              if (props.event.key === "Escape") {
                comp?.element.remove();
                return true;
              }
              return comp?.ref?.onKeyDown(props) ?? false;
            },
            onExit: () => {
              comp?.element.remove();
              comp?.destroy();
              comp = null;
            }
          };
        }
      })
    ];
  }
});
