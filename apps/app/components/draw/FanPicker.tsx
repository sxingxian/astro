"use client";

import { CardBack } from "@astro/ui";
import { gsap } from "gsap";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useT } from "../CopyProvider";
import { angleStep, cardAngle, cardLift, clampRotation, coastStep, DESKTOP_FAN, dragDegrees, edgeVelocity, type FanGeometry, geometryFor, indexAt, keepVisible, maxRotation } from "@/lib/draw/fan-geometry";

interface Props {
  size: number;
  selected: number[];
  limit: number;
  locked?: boolean;
  label: string;
  onToggle: (position: number) => void;
}

const EDGE_ZONE = 115;
const SLIDE_SPEED = 3;
/** Cards turned further than this are off the arc: not drawn and not clickable. */
const VISIBLE_ANGLE = 72;
/** A press that moves further than this is a drag that turns the fan, not a tap. */
const DRAG_START = 8;

interface CardProps {
  i: number;
  angle: number;
  lift: number;
  visible: boolean;
  picked: boolean;
  lifted: boolean;
  tabStop: boolean;
  locked: boolean;
  transition: string;
  g: FanGeometry;
  label: string;
  setRef: (i: number, el: HTMLButtonElement | null) => void;
  onCardFocus: (i: number) => void;
  onCardBlur: (e: React.FocusEvent<HTMLButtonElement>) => void;
  onCardKey: (i: number, e: React.KeyboardEvent<HTMLButtonElement>) => void;
  onCardEnter: (i: number) => void;
}

/** One card. Memoised: turning the fan moves only the ring, so cards redraw only when their own place changes. */
const FanCard = memo(function FanCard(p: CardProps) {
  return (
    <button
      ref={(el) => p.setRef(p.i, el)}
      type="button"
      className="fan-card"
      aria-label={p.label}
      aria-pressed={p.picked}
      data-lifted={p.lifted ? "" : undefined}
      tabIndex={p.tabStop ? 0 : -1}
      disabled={p.locked}
      style={{
        top: p.g.cardTop,
        width: p.g.cardW,
        height: p.g.cardH,
        marginLeft: -p.g.cardW / 2,
        transformOrigin: `50% ${p.g.radius}px`,
        transform: `rotate(${p.angle.toFixed(2)}deg) translateY(${(-p.lift).toFixed(1)}px)`,
        zIndex: p.lifted ? 400 : p.i,
        // Opacity, not visibility: off-arc cards stay focusable, so arrow keys can still reach them.
        opacity: p.visible ? 1 : 0,
        pointerEvents: "none",
        transition: p.transition
      }}
      onFocus={() => p.onCardFocus(p.i)}
      onBlur={p.onCardBlur}
      onClick={(e) => {
        if (e.detail === 0) p.onCardEnter(p.i); // Enter or Space
      }}
      onKeyDown={(e) => p.onCardKey(p.i, e)}
    >
      <CardBack />
    </button>
  );
});

/**
 * The fan-out card picker (approved prototype "Option 5 · Fan out"). The shuffled deck fans out like a hand of
 * cards. A finger drags the fan round (a flick lets it coast); a tap picks the card under it. With a mouse, the
 * card under the pointer lifts, and resting near either edge turns the fan. Each card is a real button
 * ("Card N of M"): arrow keys move along the fan, Enter picks. Only positions ever leave the browser.
 *
 * The whole fan turns as one layer (the ring), so turning never restarts 78 card animations; cards animate only
 * when they lift or settle.
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
  // The ring follows a finger or the ticker directly; it eases only for keyboard turns.
  const [ringEase, setRingEase] = useState(false);
  const [reduced, setReduced] = useState(false);
  const focusAtDown = useRef(-1);
  // The press in progress: where and when it went down, the card under it then, and the fan's turn then.
  const press = useRef<{ id: number; x: number; y: number; t: number; card: number; rot: number; dragging: boolean; touch: boolean } | null>(null);
  // Set when a press turned into a drag, so the click that follows it picks nothing.
  const dragged = useRef(false);
  // The press that just ended without dragging: the click after it may be a tap.
  const tap = useRef<{ x: number; y: number; t: number; card: number } | null>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const sample = useRef<{ x: number; t: number; v: number } | null>(null);
  const edge = useRef(0);
  const coast = useRef(0);
  // Phones get the prototype's fan; a wide stage (desktop panel) gets mockup D2's larger cards.
  const g = geometryFor(width);
  const live = useRef({ rot: 0, width: 390, g, focus: -1 });
  live.current = { rot, width, g, focus };

  // Reduce Motion: no fan-out animation, no coasting and no sliding motion.
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
  const cardAt = useCallback(
    (p: { x: number; y: number } | null, r: number, f = live.current.focus) => {
      const l = live.current;
      return p ? indexAt(p.x - l.width / 2, p.y - (l.g.cardTop + l.g.radius), r, size, l.g, f) : -1;
    },
    [size]
  );

  const turnTo = useCallback(
    (next: number) => {
      const l = live.current;
      const clamped = clampRotation(next, size, l.width, l.g);
      l.rot = clamped;
      setRot(clamped);
      return clamped;
    },
    [size]
  );

  // GSAP's ticker turns the fan while a mouse rests in an edge zone, and lets a flicked fan coast to a stop.
  const tick = useCallback(
    (_time: number, _delta: number, _frame: number) => {
      const frames = gsap.ticker.deltaRatio(60);
      if (coast.current) {
        const before = live.current.rot;
        const after = turnTo(before + coast.current * frames);
        // Stops at the end of the deck instead of pushing against it.
        coast.current = after === before ? 0 : coastStep(coast.current, frames);
        return;
      }
      const v = edge.current;
      if (!v) return;
      const before = live.current.rot;
      const after = turnTo(before + v * frames);
      if (after === before) return setSliding(0);
      setSliding(v > 0 ? 1 : -1);
      const i = cardAt(last.current, after);
      if (i >= 0) setFocus(i);
    },
    [cardAt, turnTo]
  );
  useEffect(() => {
    if (reduced) {
      // Reduce Motion: the fan jumps a card at a time instead of sliding.
      const id = window.setInterval(() => {
        const v = edge.current;
        if (v) turnTo(live.current.rot + Math.sign(v) * angleStep(size));
      }, 250);
      return () => window.clearInterval(id);
    }
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, [tick, reduced, size, turnTo]);

  // Edge zones are for a resting mouse only: on a phone the finger drags the fan instead.
  const updateEdge = (p: { x: number; y: number } | null) => {
    edge.current = p && p.y > 40 ? edgeVelocity(p.x, live.current.width, EDGE_ZONE, SLIDE_SPEED) : 0;
    if (!edge.current) setSliding(0);
  };
  const stopEdge = () => {
    edge.current = 0;
    setSliding(0);
  };

  const toggle = (i: number) => {
    if (locked) return;
    const isPicked = selected.includes(i);
    if (isPicked || selected.length < limit || limit === 1) onToggle(i);
  };
  const toggleRef = useRef(toggle);
  toggleRef.current = toggle;

  const setRef = useCallback((i: number, el: HTMLButtonElement | null) => {
    buttons.current[i] = el;
  }, []);
  const focusCard = useCallback(
    (i: number) => buttons.current[Math.max(0, Math.min(size - 1, i))]?.focus(),
    [size]
  );
  const onCardFocus = useCallback(
    (i: number) => {
      setFocus(i);
      coast.current = 0;
      setRingEase(true);
      const l = live.current;
      turnTo(keepVisible(i, l.rot, size, l.width, l.g));
    },
    [size, turnTo]
  );
  const onCardBlur = useCallback((e: React.FocusEvent<HTMLButtonElement>) => {
    if (!stageRef.current?.contains(e.relatedTarget as Node | null)) setFocus(-1);
  }, []);
  const onCardKey = useCallback(
    (i: number, e: React.KeyboardEvent<HTMLButtonElement>) => {
      const go = (n: number) => {
        e.preventDefault();
        focusCard(n);
      };
      if (e.key === "ArrowRight" || e.key === "ArrowUp") go(i + 1);
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") go(i - 1);
      if (e.key === "Home") go(0);
      if (e.key === "End") go(size - 1);
    },
    [focusCard, size]
  );
  const onCardEnter = useCallback((i: number) => toggleRef.current(i), []);

  const endPress = () => {
    const pr = press.current;
    press.current = null;
    tap.current = pr && !pr.dragging ? pr : null;
    if (!pr?.dragging) return;
    // A flick keeps the fan moving; it slows to a stop on its own.
    const s = sample.current;
    coast.current = !reduced && s && performance.now() - s.t < 80 ? dragDegrees(s.v * (1000 / 60), live.current.g) : 0;
    if (pr.touch) setFocus(-1);
  };

  const tabStop = focus >= 0 ? focus : (selected[0] ?? Math.floor(size / 2));
  // Arrows show only when the fan can still turn that way (a fan that fits the stage has none).
  const maxRot = maxRotation(size, width, g);
  const leftMore = fanned && rot < maxRot - 0.5;
  const rightMore = fanned && rot > -maxRot + 0.5;
  const cardTransition = reduced ? "none" : !settled ? null : "transform 180ms cubic-bezier(.22,1,.36,1)";

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
        data-size={g === DESKTOP_FAN ? "desktop" : "phone"}
        style={{ height: g.stageH }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          const p = local(e);
          if (!p) return;
          coast.current = 0;
          setRingEase(false);
          dragged.current = false;
          last.current = p;
          sample.current = { x: e.clientX, t: performance.now(), v: 0 };
          const touch = e.pointerType !== "mouse";
          const card = cardAt(p, live.current.rot);
          press.current = { id: e.pointerId, x: p.x, y: p.y, t: e.timeStamp, card, rot: live.current.rot, dragging: false, touch };
          focusAtDown.current = touch ? card : focus;
          if (touch) {
            if (card >= 0) setFocus(card);
          } else {
            stopEdge();
          }
          e.currentTarget.setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          const p = local(e);
          last.current = p;
          const pr = press.current;
          if (pr && pr.id === e.pointerId && p) {
            const dx = p.x - pr.x;
            if (!pr.dragging && Math.abs(dx) > DRAG_START) {
              pr.dragging = true;
              dragged.current = true;
              setFocus(-1);
            }
            if (pr.dragging) {
              turnTo(pr.rot + dragDegrees(dx, live.current.g));
              const now = performance.now();
              const s = sample.current;
              if (s && now > s.t) sample.current = { x: e.clientX, t: now, v: 0.7 * ((e.clientX - s.x) / (now - s.t)) + 0.3 * s.v };
            }
            return;
          }
          if (e.pointerType !== "mouse" || coast.current) return;
          const i = cardAt(p, live.current.rot);
          if (i !== focus) setFocus(i);
          updateEdge(p);
        }}
        onPointerUp={endPress}
        onPointerCancel={() => {
          endPress();
          stopEdge();
        }}
        onPointerLeave={(e) => {
          if (press.current) return; // captured: the press ends on pointerup
          stopEdge();
          if (e.pointerType === "mouse" && !stageRef.current?.contains(document.activeElement)) setFocus(-1);
        }}
        onClick={(e) => {
          if (e.detail === 0) return; // keyboard: handled by the card button itself
          if (dragged.current) {
            dragged.current = false;
            return;
          }
          const p = local(e);
          const d = tap.current;
          tap.current = null;
          // A tap (barely moved, quickly lifted) picks the card that was under it when it went down.
          if (p && d && d.card >= 0 && Math.hypot(p.x - d.x, p.y - d.y) < 10 && e.timeStamp - d.t < 350) return toggle(d.card);
          const i = cardAt(p, live.current.rot);
          if (i >= 0 && i === focusAtDown.current) toggle(i);
        }}
      >
        <div
          className="fan-ring"
          style={{
            transformOrigin: `50% ${g.cardTop + g.radius}px`,
            transform: `rotate(${rot.toFixed(2)}deg)`,
            transition: ringEase && !reduced ? "transform 220ms cubic-bezier(.22,1,.36,1)" : "none"
          }}
        >
          {Array.from({ length: size }, (_, i) => {
            const picked = selected.includes(i);
            const angle = fanned ? cardAngle(i, size, 0, focus) : 0;
            return (
              <FanCard
                key={i}
                i={i}
                angle={angle}
                lift={fanned ? cardLift(i, focus, picked, g) : 0}
                visible={Math.abs(angle + rot) < VISIBLE_ANGLE}
                picked={picked}
                lifted={i === focus && fanned}
                tabStop={i === tabStop}
                locked={locked}
                transition={cardTransition ?? `transform 800ms cubic-bezier(.22,1,.36,1) ${i * 6}ms`}
                g={g}
                label={t("app.draw.card_n", { n: String(i + 1), total: String(size) })}
                setRef={setRef}
                onCardFocus={onCardFocus}
                onCardBlur={onCardBlur}
                onCardKey={onCardKey}
                onCardEnter={onCardEnter}
              />
            );
          })}
        </div>
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
