import { useMemo, useState } from 'react';
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

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex max-w-switcher items-center gap-1.5 rounded-control px-2.5 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-inset ring-transparent transition hover:bg-slate-100 hover:text-slate-900 hover:ring-slate-200/80"
      >
        <SquareKanban className="h-4 w-4 shrink-0 text-slate-400" />
        <span className="truncate">{current ? current.name : 'Switch board'}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-dropdown mt-2 w-72 overflow-hidden rounded-surface bg-white shadow-pop ring-1 ring-slate-200/80 animate-pop-in">
          <div className="border-b border-slate-100 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search boards…"
                className="input bg-slate-50 py-1.5 pl-8 text-sm shadow-none"
              />
            </div>
          </div>

          <ul role="listbox" className="thin-scrollbar max-h-72 overflow-y-auto p-1.5">
            {filtered.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-slate-400">No boards match “{query}”</li>
            )}
            {filtered.map((board) => (
              <li key={board.id}>
                <button
                  onClick={() => go(board.id)}
                  className={`flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-left text-sm transition ${
                    board.id === currentBoardId ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex-1 truncate font-medium">{board.name}</span>
                  {board.id === currentBoardId && <Check className="h-4 w-4 shrink-0 text-brand-600" />}
                </button>
              </li>
            ))}
          </ul>

          <button
            onClick={() => {
              setOpen(false);
              navigate('/boards?new=1');
            }}
            className="flex w-full items-center gap-2 border-t border-slate-100 px-3.5 py-2.5 text-sm font-medium text-brand-600 transition hover:bg-brand-50"
          >
            <Plus className="h-4 w-4" />
            Create new board
          </button>
        </div>
      )}
    </div>
  );
}
