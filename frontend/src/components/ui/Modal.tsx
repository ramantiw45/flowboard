import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

type Size = 'sm' | 'md' | 'lg';

const SIZES: Record<Size, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  size?: Size;
}

/**
 * Stack of closers for the open dialogs, innermost last.
 *
 * A modal registers a *stable* closer (a ref-backed function rather than its
 * `onClose` prop) so the shared Escape listener can tell which dialog is the
 * innermost one. Stacked dialogs - card details with a delete confirmation on
 * top - then dismiss one layer per Escape instead of all of them at once.
 */
const modalStack: Array<() => void> = [];

/**
 * Focusables the trap cycles over, in document order.
 *
 * `offsetParent` is the visibility test; the panel itself is a focusable
 * (tabindex="-1") ancestor of everything inside, so it is excluded explicitly
 * rather than by the `[tabindex]` branch, which would otherwise wrap around
 * to the dialog node instead of the last real control.
 */
const TABBABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function tabbablesIn(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)].filter(
    (el) => el.offsetParent !== null || el === document.activeElement
  );
}

/**
 * Portal-rendered dialog: focus trap, Escape-to-close, initial-focus, focus
 * restore, body scroll lock and an accessible role/label pairing.
 *
 * Focus is trapped with a Tab/Shift+Tab cycle over the dialog's own tabbables
 * (no sentinel nodes), moved to the first field on open (or the dialog itself
 * when there is nothing focusable), and returned to the previously focused
 * element on close. Escape closes only the innermost stacked dialog.
 */
export default function Modal({ open, title, description, onClose, children, size = 'md' }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Every call site passes an inline arrow, so the listener below must not
  // depend on that identity: re-running the effect on each parent render would
  // re-capture "previously focused" as the dialog's own field and re-trigger
  // the initial focus, leaving focus to jump back on every keystroke-driven
  // re-render. The ref keeps the latest closer without resubscribing.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closerRef = useRef<() => void>();
  if (!closerRef.current) closerRef.current = () => onCloseRef.current();
  const closer = closerRef.current;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    modalStack.push(closer);

    const onKey = (e: KeyboardEvent) => {
      // Only the innermost stacked dialog answers; an outer Modal must not
      // also close on the same keypress.
      if (e.key === 'Escape') {
        if (modalStack[modalStack.length - 1] !== closer) return;
        e.stopPropagation();
        closer();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const root = panelRef.current;
      const tabbables = tabbablesIn(root);
      if (tabbables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = tabbables[0];
      const last = tabbables[tabbables.length - 1];
      const active = document.activeElement;
      // A click or a programmatic move can leave focus outside the panel; pull
      // it back rather than letting the next Tab land in the page behind.
      if (!root.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Capture phase: the dialog answers Escape before the click-outside Escape
    // handlers behind it, and before the dnd keyboard sensor sees a keypress.
    window.addEventListener('keydown', onKey, true);
    // Focus the first field when there is one (a dialog that opens already
    // pointing at its input needs no extra Tab), otherwise the panel itself so
    // keyboard users land inside the dialog rather than behind it.
    const t = window.setTimeout(() => {
      const root = panelRef.current;
      if (!root) return;
      const firstField = tabbablesIn(root).find((el) =>
        el.matches('input, textarea, select')
      );
      (firstField ?? root).focus();
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey, true);
      const i = modalStack.lastIndexOf(closer);
      if (i >= 0) modalStack.splice(i, 1);
      previouslyFocused?.focus?.();
    };
  }, [open, closer]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-modal flex items-start justify-center overflow-y-auto bg-slate-950/60 p-4 pt-16 backdrop-blur-sm animate-overlay-in sm:items-center sm:pt-4"
      onMouseDown={onClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`w-full ${SIZES[size]} rounded-overlay bg-white shadow-sheet animate-modal-in`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-base font-bold tracking-tight text-slate-900">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="-mr-1 -mt-1 flex min-h-8 min-w-8 shrink-0 items-center justify-center rounded-control p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}

