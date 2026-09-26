import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/** How many cards to render beyond the viewport, above and below. */
const OVERSCAN = 6;

/**
 * Windowing for a scrolling column of fixed-stride items.
 *
 * Returns the slice of `items` to render plus the spacer sizes that stand in for
 * the ones that are not, so the scrollbar keeps representing the whole list.
 *
 * The stride is measured from the DOM rather than assumed. Cards here have a
 * variable height (the title is clamped to three lines), so a hard-coded stride
 * would make the scrollbar lie and, worse, make the library's placeholder maths
 * disagree with reality. One measurement is enough: cards in a column are close
 * enough in height that a stride taken from a rendered sample keeps the list
 * scrollable and the drop index correct.
 *
 * Kept in its own module, and free of React and dnd types, so the arithmetic
 * can be unit tested directly - it is the part most likely to be subtly wrong,
 * and the part hardest to debug by looking at the screen.
 */
export interface VirtualWindow {
  /** Indices of `items` that should be rendered, ascending. */
  start: number;
  end: number;
  /** Pixels of unmounted cards above the first rendered one. */
  topSpacer: number;
  /** Pixels of unmounted cards below the last rendered one. */
  bottomSpacer: number;
}

/** The window to render, given the list geometry. Pure, so it can be tested. */
export function computeWindow(params: {
  total: number;
  /** Observed height of one card including its gap. */
  stride: number;
  /** Current scroll offset within the list. */
  scrollTop: number;
  /** Visible height of the list. */
  viewportHeight: number;
  overscan?: number;
}): VirtualWindow {
  const { total, stride, scrollTop, viewportHeight, overscan = OVERSCAN } = params;
  if (total === 0) return { start: 0, end: 0, topSpacer: 0, bottomSpacer: 0 };

  // A stride of 0 would divide by zero below. It only happens before the first
  // measurement, at which point rendering everything is the safe answer.
  if (stride <= 0) {
    return { start: 0, end: total, topSpacer: 0, bottomSpacer: 0 };
  }

  const firstVisible = Math.floor(scrollTop / stride);
  const visibleCount = Math.ceil(viewportHeight / stride) + 1;

  // `scrollTop` can exceed the list (overscroll, a stale measurement after the
  // list shrank, a test feeding an absurd offset), which would otherwise make
  // `start` run past `total` and leave an inverted window. Clamping `start` to
  // `total` keeps the slice valid, and the empty case is handled above.
  const start = Math.max(0, Math.min(total, firstVisible - overscan));
  const end = Math.max(start, Math.min(total, firstVisible + visibleCount + overscan));

  return {
    start,
    end,
    topSpacer: start * stride,
    bottomSpacer: Math.max(0, (total - end) * stride),
  };
}

export interface UseVirtualWindowResult extends VirtualWindow {
  /** Attach to the scrolling element. */
  scrollRef: (node: HTMLDivElement | null) => void;
  /** Attach to a rendered card, so the stride can be measured from reality. */
  itemRef: (node: HTMLElement | null) => void;
  /** Attach to the scrolling element's `onScroll`. */
  onScroll: () => void;
}

/**
 * Wires {@link computeWindow} to a scroll container.
 *
 * Disabled (renders everything) until the container has been measured or the
 * item count is under `threshold`, so short columns behave exactly as before.
 */
export function useVirtualWindow(
  total: number,
  threshold: number
): UseVirtualWindowResult {
  const enabled = total > threshold;
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [stride, setStride] = useState(0);
  const nodeRef = useRef<HTMLDivElement | null>(null);

  const scrollRef = useCallback((node: HTMLDivElement | null) => {
    nodeRef.current = node;
    if (node) {
      setScrollTop(node.scrollTop);
      setViewportHeight(node.clientHeight);
    }
  }, []);

  const itemRef = useCallback((node: HTMLElement | null) => {
    if (!node) return;
    // Measure once, from the first card to render. Including the sibling gap
    // matters: the cards are laid out with space-y-2, and ignoring it would
    // under-count the total height by 8px per card.
    const gap = parseFloat(getComputedStyle(node).marginBottom || '0');
    const measured = node.getBoundingClientRect().height + (Number.isNaN(gap) ? 0 : gap);
    if (measured > 0) setStride((current) => (current === 0 ? measured : current));
  }, []);

  // The container's own size can change without a scroll event (window
  // resize, the activity panel opening), and a stale viewport height would
  // render too few cards and leave a blank strip.
  useEffect(() => {
    const node = nodeRef.current;
    if (!node || !enabled) return;
    const observer = new ResizeObserver(() => setViewportHeight(node.clientHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled]);

  // A shorter list must not keep a window from when it was long.
  useEffect(() => {
    if (!enabled) setStride(0);
  }, [enabled]);

  const onScroll = useCallback(() => {
    const node = nodeRef.current;
    if (node) setScrollTop(node.scrollTop);
  }, []);

  const window = useMemo(
    () =>
      enabled
        ? computeWindow({ total, stride, scrollTop, viewportHeight })
        : { start: 0, end: total, topSpacer: 0, bottomSpacer: 0 },
    [enabled, total, stride, scrollTop, viewportHeight]
  );

  return { ...window, scrollRef: enabled ? scrollRef : () => undefined, itemRef: enabled ? itemRef : () => undefined, onScroll: enabled ? onScroll : () => undefined };
}