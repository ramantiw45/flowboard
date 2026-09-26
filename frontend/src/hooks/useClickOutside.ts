import { useEffect, useRef, type RefObject } from 'react';

/** Fires `onOutside` for pointer events landing outside the referenced element. */
export function useClickOutside<T extends HTMLElement>(
  onOutside: () => void,
  enabled = true
): RefObject<T> {
  const ref = useRef<T>(null);
  const handler = useRef(onOutside);
  handler.current = onOutside;

  useEffect(() => {
    if (!enabled) return;
    const listener = (event: MouseEvent | TouchEvent) => {
      const el = ref.current;
      if (el && !el.contains(event.target as Node)) handler.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handler.current();
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
      window.removeEventListener('keydown', onKey);
    };
  }, [enabled]);

  return ref;
}
