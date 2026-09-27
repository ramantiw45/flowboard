import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronDown, Plus, Search, SquareKanban } from 'lucide-react';
import type { BoardSummary } from '../../types';
import { useClickOutside } from '../../hooks/useClickOutside';

/**
 * Command-palette style board picker: replaces the native <select> with a
 * searchable popover so teams with many boards stay navigable.
 */
export default function BoardSwitcher({
  boards,
  currentBoardId,
}: {
  boards: BoardSummary[];
  currentBoardId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false), open);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const current = boards.find((b) => b.id === currentBoardId);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? boards.filter((b) => b.name.toLowerCase().includes(q)) : boards;
  }, [boards, query]);

  if (boards.length === 0) return null;

  const go = (id: string) => {
    setOpen(false);
    setQuery('');
    navigate(`/boards/${id}`);
  };

  /**
   * Arrow keys move a real focus cursor through the options (the option itself
   * is the focusable button, so no aria-activedescendant bookkeeping is
   * needed), Home/End jump to the ends, and the list wraps so a long board list
   * stays reachable from the search field with two Arrow presses.
   */
  const onListKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    const options = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="option"]')];
    if (options.length === 0) return;
    const activeIndex = options.indexOf(document.activeElement as HTMLElement);
    let next = -1;
    if (e.key === 'ArrowDown') next = activeIndex < 0 ? 0 : (activeIndex + 1) % options.length;
    else if (e.key === 'ArrowUp') next = activeIndex < 0 ? options.length - 1 : (activeIndex - 1 + options.length) % options.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = options.length - 1;
    else return;
    e.preventDefault();
    options[next].focus();
  };

  /** Arrow keys from the search field drop the cursor into the option list. */
  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const options = [...(listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
    if (options.length === 0) return;
    e.preventDefault();
    options[e.key === 'ArrowDown' ? 0 : options.length - 1].focus();
  };

  /** Dismiss with Escape and hand focus back to the trigger it came from. */
  const closeToTrigger = () => {
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  };

  return (
    <div ref={ref} className="relative">
      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={current ? `Switch board, current: ${current.name}` : 'Switch board'}
        className="flex max-w-switcher items-center gap-1.5 rounded-control px-2.5 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-inset ring-transparent transition hover:bg-slate-100 hover:text-slate-900 hover:ring-slate-200/80"
      >
        <SquareKanban className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
        <span className="truncate">{current ? current.name : 'Switch board'}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-dropdown mt-2 w-72 overflow-hidden rounded-surface bg-white shadow-pop ring-1 ring-slate-200/80 animate-pop-in"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              closeToTrigger();
            }
          }}
        >
          <div className="border-b border-slate-100 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="Search boards…"
                aria-label="Search boards"
                className="input bg-slate-50 py-1.5 pl-8 text-sm shadow-none"
              />
            </div>
          </div>

          <ul
            ref={listRef}
            role="listbox"
            aria-label="Boards"
            onKeyDown={onListKeyDown}
            className="thin-scrollbar max-h-72 overflow-y-auto p-1.5"
          >
            {filtered.length === 0 && (
              <li role="presentation" className="px-3 py-6 text-center text-sm text-slate-500">
                No boards match “{query}”
              </li>
            )}
            {filtered.map((board) => (
              <li key={board.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={board.id === currentBoardId}
                  onClick={() => go(board.id)}
                  className={`flex min-h-9 w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-left text-sm transition ${
                    board.id === currentBoardId ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex-1 truncate font-medium">{board.name}</span>
                  {board.id === currentBoardId && <Check className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ul>

          <button
            onClick={() => {
              setOpen(false);
              navigate('/boards?new=1');
            }}
            className="flex min-h-9 w-full items-center gap-2 border-t border-slate-100 px-3.5 py-2.5 text-sm font-medium text-brand-600 transition hover:bg-brand-50"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create new board
          </button>
        </div>
      )}
    </div>
  );
}
