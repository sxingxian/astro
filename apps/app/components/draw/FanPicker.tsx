"use client";

import { CardBack } from "@astro/ui";
import { gsap } from "gsap";
import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "../CopyProvider";
import { cardAngle, cardLift, clampRotation, edgeVelocity, indexAt, keepVisible, angleStep } from "@/lib/draw/fan-geometry";

interface Props {
  size: number;
  selected: number[];
  limit: number;
  locked?: boolean;
  label: string;
  onToggle: (position: number) => void;
}

const STAGE_H = 440;
const CARD_TOP = 250;
const PIVOT_FROM_CARD_TOP = 256;
const PIVOT_Y = CARD_TOP + PIVOT_FROM_CARD_TOP;
const EDGE_ZONE = 115;
const SLIDE_SPEED = 3;
/** Cards turned further than this are off the arc: not drawn and not clickable. */
const VISIBLE_ANGLE = 72;

/**
 * The fan-out card picker (approved prototype "Option 5 · Fan out"). The shuffled deck fans out like a hand of
 * cards; slide across it and the card under the finger lifts; tap it to pick. Near either edge the fan turns to
 * bring more cards in. Each card is a real button ("Card N of M"): arrow keys move along the fan, Enter picks.
 * Only positions ever leave the browser.
 */
export function FanPicker({ size, selected, limit, locked = false, label, onToggle }: Props) {
  const t = useT();
  const stageRef = useRef<HTMLDivElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const [width, setWidth] = useState(390);
  const [rot, setRot] = useState(0);
  const [focus, setFocus] = useState(-1);
  const [fanned, setFanned] = useState(false);
  const [settled, setSettled] = useState(false);
  const [sliding, setSliding] = useState(0);
  const [reduced, setReduced] = useState(false);
  const pressed = useRef(false);
  const focusAtDown = useRef(-1);
  // Where and when the pointer went down, and the card under it then: the fan may turn under a tap in an edge zone.
  const down = useRef<{ x: number; y: number; t: number; card: number } | null>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const velocity = useRef(0);
  const live = useRef({ rot: 0, width: 390 });
  live.current = { rot, width };

  // Reduce Motion: no fan-out animation and no sliding motion.
  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add({ reduce: "(prefers-reduced-motion: reduce)", ok: "(prefers-reduced-motion: no-preference)" }, (ctx) => {
      const r = Boolean(ctx.conditions?.reduce);
      setReduced(r);
      if (r) {
        setFanned(true);
        setSettled(true);
        return;
      }
      const a = window.setTimeout(() => setFanned(true), 150);
      const b = window.setTimeout(() => setSettled(true), 1400);
      return () => {
        window.clearTimeout(a);
        window.clearTimeout(b);
      };
    });
    return () => mm.revert();
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => entry && setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = stageRef.current?.getBoundingClientRect();
    return r ? { x: e.clientX - r.left, y: e.clientY - r.top } : null;
  };
  const cardAt = useCallback((p: { x: number; y: number } | null, r: number) => (p ? indexAt(p.x - live.current.width / 2, p.y - PIVOT_Y, r, size) : -1), [size]);

  // The edge slide: GSAP's ticker turns the fan while the pointer rests in an edge zone.
  const tick = useCallback(
    (_time: number, _delta: number, _frame: number) => {
      const v = velocity.current;
      if (!v) return;
      const next = clampRotation(live.current.rot + v, size, live.current.width);
      if (next === live.current.rot) return setSliding(0);
      live.current.rot = next;
      setRot(next);
      setSliding(v > 0 ? 1 : -1);
      const i = cardAt(last.current, next);
      if (i >= 0) setFocus(i);
    },
    [size, cardAt]
  );
  useEffect(() => {
    if (reduced) {
      // Reduce Motion: the fan jumps a card at a time instead of sliding.
      const id = window.setInterval(() => {
        const v = velocity.current;
        if (!v) return;
        const next = clampRotation(live.current.rot + Math.sign(v) * angleStep(size), size, live.current.width);
        setRot(next);
      }, 250);
      return () => window.clearInterval(id);
    }
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, [tick, reduced, size]);

  const updateEdge = (p: { x: number; y: number } | null) => {
    velocity.current = p && p.y > 40 ? edgeVelocity(p.x, live.current.width, EDGE_ZONE, SLIDE_SPEED) : 0;
    if (!velocity.current) setSliding(0);
  };

  const toggle = (i: number) => {
    if (locked) return;
    const isPicked = selected.includes(i);
    if (isPicked || selected.length < limit || limit === 1) onToggle(i);
  };

  const focusCard = (i: number) => {
    const n = Math.max(0, Math.min(size - 1, i));
    buttons.current[n]?.focus();
  };

  const tabStop = focus >= 0 ? focus : (selected[0] ?? Math.floor(size / 2));
  const leftMore = fanned && cardAngleRaw(0) < -50;
  const rightMore = fanned && cardAngleRaw(size - 1) > 50;
  function cardAngleRaw(i: number) {
    return cardAngle(i, size, rot, -1);
  }

  const focusText =
    focus >= 0
      ? t(selected.includes(focus) ? "app.draw.fan_focus_picked" : "app.draw.fan_focus", { n: String(focus + 1), total: String(size) })
      : t("app.draw.fan_hint");

  return (
    <div className="fan-wrap">
      <p className="m-0 px-5 text-center text-sm text-haze" aria-hidden="true">{focusText}</p>
      <div
        ref={stageRef}
        role="group"
        aria-label={label}
        data-testid="fan-stage"
        data-rot={rot.toFixed(1)}
        className="fan-stage"
        style={{ height: STAGE_H }}
        onPointerDown={(e) => {
          pressed.current = true;
          focusAtDown.current = focus;
          const p = local(e);
          last.current = p;
          down.current = p ? { x: p.x, y: p.y, t: e.timeStamp, card: cardAt(p, rot) } : null;
          if (e.pointerType !== "mouse") {
            const i = cardAt(p, rot);
            if (i >= 0) {
              setFocus(i);
              focusAtDown.current = i;
            }
            updateEdge(p);
          }
        }}
        onPointerMove={(e) => {
          if (!pressed.current && e.pointerType !== "mouse") return;
          const p = local(e);
          last.current = p;
          const i = cardAt(p, rot);
          if (i >= 0 && i !== focus) setFocus(i);
          updateEdge(p);
        }}
        onPointerUp={(e) => {
          pressed.current = false;
          if (e.pointerType !== "mouse") updateEdge(null);
        }}
        onPointerLeave={() => {
          pressed.current = false;
          updateEdge(null);
          if (!stageRef.current?.contains(document.activeElement)) setFocus(-1);
        }}
        onPointerCancel={() => {
          pressed.current = false;
          updateEdge(null);
        }}
        onClick={(e) => {
          if (e.detail === 0) return; // keyboard: handled by the card button itself
          const p = local(e);
          const d = down.current;
          down.current = null;
          // A tap (barely moved, quickly lifted) picks the card that was under it when it went down.
          if (p && d && d.card >= 0 && Math.hypot(p.x - d.x, p.y - d.y) < 10 && e.timeStamp - d.t < 350) return toggle(d.card);
          const i = cardAt(p, rot);
          if (i >= 0 && i === focusAtDown.current) toggle(i);
        }}
      >
        {Array.from({ length: size }, (_, i) => {
          const picked = selected.includes(i);
          const angle = fanned ? cardAngle(i, size, rot, focus) : 0;
          const visible = Math.abs(angle) < VISIBLE_ANGLE;
          const lift = fanned ? cardLift(i, focus, picked) : 0;
          const transition = reduced ? "none" : !settled ? `transform 800ms cubic-bezier(.22,1,.36,1) ${i * 6}ms` : sliding ? "transform 70ms linear" : "transform 180ms cubic-bezier(.22,1,.36,1)";
          return (
            <button
              key={i}
              ref={(el) => { buttons.current[i] = el; }}
              type="button"
              className="fan-card"
              aria-label={t("app.draw.card_n", { n: String(i + 1), total: String(size) })}
              aria-pressed={picked}
              data-lifted={i === focus && fanned ? "" : undefined}
              tabIndex={i === tabStop ? 0 : -1}
              disabled={locked}
              style={{
                top: CARD_TOP,
                transformOrigin: `50% ${PIVOT_FROM_CARD_TOP}px`,
                transform: `rotate(${angle.toFixed(2)}deg) translateY(${(-lift).toFixed(1)}px)`,
                zIndex: i === focus ? 400 : i,
                opacity: visible ? 1 : 0,
                pointerEvents: "none",
                transition
              }}
              onFocus={() => {
                setFocus(i);
                setRot((r) => keepVisible(i, r, size, live.current.width));
              }}
              onBlur={(e) => {
                if (!stageRef.current?.contains(e.relatedTarget as Node | null)) setFocus(-1);
              }}
              onClick={(e) => {
                if (e.detail === 0) toggle(i); // Enter or Space
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); focusCard(i + 1); }
                if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); focusCard(i - 1); }
                if (e.key === "Home") { e.preventDefault(); focusCard(0); }
                if (e.key === "End") { e.preventDefault(); focusCard(size - 1); }
              }}
            >
              <CardBack />
            </button>
          );
        })}
        <div aria-hidden="true" className="fan-edge fan-edge-left" data-on={leftMore || undefined} data-sliding={sliding > 0 || undefined}>
          <svg width="22" height="22" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <div aria-hidden="true" className="fan-edge fan-edge-right" data-on={rightMore || undefined} data-sliding={sliding < 0 || undefined}>
          <svg width="22" height="22" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
      </div>
    </div>
  );
}
