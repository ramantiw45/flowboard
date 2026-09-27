import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

interface Toast {
  id: number;
  message: string;
  kind: 'success' | 'error' | 'info';
  /** Toasts linger longer when they explain a failure. */
  duration: number;
}

interface ToastContextValue {
  push: (message: string, kind?: Toast['kind']) => void;
}

const ToastContext = createContext<ToastContextValue>({ push: () => undefined });

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

const ICONS = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
} as const;

const ACCENT = {
  success: 'text-success-400',
  error: 'text-danger-400',
  info: 'text-info-400',
} as const;

const MAX_VISIBLE = 4;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (message: string, kind: Toast['kind'] = 'success') => {
      const id = Date.now() + Math.random();
      const duration = kind === 'error' ? 6500 : 3500;
      setToasts((prev) => [...prev.slice(-(MAX_VISIBLE - 1)), { id, message, kind, duration }]);
      timers.current.set(id, setTimeout(() => dismiss(id), duration));
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      {createPortal(
        // aria-atomic so a multi-clause message ("If that email was free ...")
        // is announced whole rather than only the fragment that changed.
        <div
          className="pointer-events-none fixed bottom-5 right-5 z-toast flex w-toast flex-col gap-2"
          role="region"
          aria-label="Notifications"
          aria-live="polite"
          aria-atomic="true"
        >
          {toasts.map((t) => {
            const Icon = ICONS[t.kind];
            return (
              <div
                key={t.id}
                className="pointer-events-auto flex items-start gap-3 overflow-hidden rounded-surface bg-slate-900/95 px-3.5 py-3 text-sm text-slate-100 shadow-sheet ring-1 ring-white/10 backdrop-blur animate-toast-in"
              >
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${ACCENT[t.kind]}`} aria-hidden="true" />
                <span className="flex-1 leading-snug">{t.message}</span>
                <button
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss notification"
                  className="-mr-1 flex min-h-8 min-w-8 shrink-0 items-center justify-center rounded-control p-1 text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

