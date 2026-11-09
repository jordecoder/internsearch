/**
 * Showcase motion primitives (Apple-style), dependency-free.
 *
 * - Reveal:      rises + unblurs into place the first time it scrolls into view.
 * - WordReveal:  headline words blur into focus one after another.
 * - CountUp:     numbers roll up from zero when first seen.
 * - useSpotlight: pointer-following highlight for tiles (pairs with `.spotlight`).
 *
 * Everything plays once, respects prefers-reduced-motion (handled in index.css
 * and here), and leaves content fully visible if JavaScript never runs.
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Fires once when the element first enters the viewport. */
function useInViewOnce<T extends Element>(onEnter: () => void, rootMargin = '0px 0px -8% 0px') {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { onEnter(); return; }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          onEnter();
        }
      },
      { rootMargin, threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

type RevealProps<E extends React.ElementType> = {
  as?: E;
  /** Position in a group; each step adds 70ms of delay. */
  index?: number;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<E>, 'as' | 'className' | 'style' | 'children'>;

export function Reveal<E extends React.ElementType = 'div'>({ as, index = 0, className, style, children, ...rest }: RevealProps<E>) {
  const Comp = (as ?? 'div') as React.ElementType;
  const [state, setState] = useState<'idle' | 'armed' | 'shown'>('idle');
  const ref = useInViewOnce<HTMLElement>(() => {
    // Two frames so the armed state is painted before the transition starts.
    requestAnimationFrame(() => requestAnimationFrame(() => setState('shown')));
  });
  useLayoutEffect(() => {
    if (!prefersReducedMotion()) setState((s) => (s === 'idle' ? 'armed' : s));
  }, []);
  return (
    <Comp
      ref={ref}
      data-reveal={state === 'idle' ? undefined : state}
      className={className}
      style={{ ...style, ['--reveal-i' as string]: Math.min(index, 10) }}
      {...rest}
    >
      {children}
    </Comp>
  );
}

export type WordSegment = { text: string; className?: string };

/**
 * Headline whose words blur into focus in sequence. Pass segments to colour
 * parts differently (Apple's two-tone headline: statement, then softer follow-up).
 */
export function WordReveal({
  segments,
  as = 'h1',
  className,
  delay = 0,
}: {
  segments: (WordSegment | string)[];
  as?: 'h1' | 'h2' | 'p' | 'span';
  className?: string;
  /** ms before the first word starts */
  delay?: number;
}) {
  const Comp = as;
  let w = 0;
  const label = segments.map((s) => (typeof s === 'string' ? s : s.text)).join('');
  return (
    <Comp className={cn('word-reveal', className)} aria-label={label} style={{ ['--word-base' as string]: `${delay}ms` }}>
      {segments.map((seg, si) => {
        const s = typeof seg === 'string' ? { text: seg } : seg;
        const parts = s.text.split(/(\s+)/).filter((p) => p.length);
        return (
          <span key={si} className={s.className} aria-hidden>
            {parts.map((p, pi) =>
              /^\s+$/.test(p) ? (
                <span key={pi}>{p}</span>
              ) : (
                <span key={pi} className="word" style={{ ['--w' as string]: w++ }}>
                  {p}
                </span>
              ),
            )}
          </span>
        );
      })}
    </Comp>
  );
}

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/** Number that rolls up from 0 the first time it scrolls into view. */
export function CountUp({
  value,
  duration = 1400,
  delay = 0,
  format = (n: number) => Math.round(n).toLocaleString('en-SG'),
  className,
}: {
  value: number;
  duration?: number;
  delay?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const [inView, setInView] = useState(false);
  const [n, setN] = useState(0);
  const current = useRef(0);
  const first = useRef(true);
  const ref = useInViewOnce<HTMLSpanElement>(() => setInView(true), '0px');

  // Tween from whatever is on screen to the latest value — so late-arriving
  // data still rolls up instead of popping in.
  useEffect(() => {
    if (!inView) return;
    if (prefersReducedMotion()) { current.current = value; setN(value); return; }
    const from = current.current;
    const wait = first.current ? delay : 0;
    first.current = false;
    let raf = 0;
    const t0 = performance.now() + wait;
    const tick = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - t0) / duration));
      const v = from + (value - from) * easeOutExpo(t);
      current.current = v;
      setN(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value]);

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {format(n)}
    </span>
  );
}

/** Pointer-following highlight. Spread the returned handler onto an element with `.spotlight`. */
export function useSpotlight() {
  return {
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
      e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
    },
  };
}

/** Animated progress ring value: starts at 0, then eases to `value` once visible. */
export function useDrawOnView(value: number, delay = 120) {
  const [v, setV] = useState(prefersReducedMotion() ? value : 0);
  const target = useRef(value);
  target.current = value;
  const ref = useInViewOnce<SVGSVGElement>(() => {
    window.setTimeout(() => setV(target.current), prefersReducedMotion() ? 0 : delay);
  }, '0px');
  useEffect(() => {
    setV((cur) => (cur === 0 && !prefersReducedMotion() ? cur : value));
  }, [value]);
  return { ref, value: v };
}
