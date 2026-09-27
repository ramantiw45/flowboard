import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Check, MoreHorizontal, Share2 } from 'lucide-react';
import type { BoardSummary } from '../../types';
import Avatar from '../ui/Avatar';
import { coverGradient } from '../../utils/theme';
import { shortDate } from '../../utils/time';
import { useClickOutside } from '../../hooks/useClickOutside';
import { useToast } from '../../context/ToastContext';

interface BoardCardProps {
  board: BoardSummary;
}

export default function BoardCard({ board }: BoardCardProps) {
  const { push } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useClickOutside<HTMLDivElement>(() => setMenuOpen(false), menuOpen);

  const copyLink = async () => {
    setMenuOpen(false);
    const url = `${window.location.origin}/boards/${board.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      push('Board link copied to clipboard');
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      push('Could not copy the link - copy it from the address bar instead.', 'error');
    }
  };

  const initials = board.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <article className="card-surface group relative flex flex-col overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:shadow-card-hover">
      {/* Decorative cover gives every board a distinct, scannable identity */}
      <Link
        to={`/boards/${board.id}`}
        aria-label={`Open ${board.name}`}
        className={`relative flex h-24 items-end bg-gradient-to-br ${coverGradient(board.id)}`}
      >
        <div className="absolute inset-0 dot-grid-cover" />
        <span className="relative mb-3 ml-4 select-none text-4xl font-black leading-none text-white/30">
          {initials || 'B'}
        </span>
      </Link>

      <div ref={menuRef} className="absolute right-2.5 top-2.5">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={`Actions for ${board.name}`}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          className="flex min-h-8 min-w-8 items-center justify-center rounded-control bg-white/25 p-1.5 text-white opacity-0 backdrop-blur-sm transition hover:bg-white/35 hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </button>

        {menuOpen && (
          <div role="menu" aria-label={`Actions for ${board.name}`} className="menu absolute right-0 top-full z-dropdown mt-1.5 w-44">
            <button
              role="menuitem"
              onClick={() => void copyLink()}
              className="flex min-h-8 w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {copied ? (
                <Check className="h-4 w-4 text-success-500" aria-hidden="true" />
              ) : (
                <Share2 className="h-4 w-4 text-slate-500" aria-hidden="true" />
              )}
              {copied ? 'Link copied' : 'Copy board link'}
            </button>
            <Link
              role="menuitem"
              to={`/boards/${board.id}`}
              className="flex min-h-8 w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <CalendarDays className="h-4 w-4 text-slate-500" aria-hidden="true" />
              Open board
            </Link>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between p-4">
        <div className="min-w-0">
          <Link
            to={`/boards/${board.id}`}
            className="block truncate text-base font-bold tracking-tight text-slate-900 transition group-hover:text-brand-600"
          >
            {board.name}
          </Link>
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
            <span title={`Owned by ${board.ownerName}`} className="truncate font-medium text-slate-600">
              {board.ownerName}
            </span>
            <span className="text-slate-400" aria-hidden="true">/</span>
            <span className="shrink-0">Owner</span>
          </div>
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-2">
            <span className="flex items-center gap-1 text-micro font-medium text-slate-500">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              {shortDate(board.createdAt)}
            </span>
            <Avatar name={board.ownerName} title={`Owner - ${board.ownerName}`} size="xs" ring={false} />
          </div>

          <Link
            to={`/boards/${board.id}`}
            aria-label={`Open ${board.name}`}
            className="flex min-h-8 shrink-0 items-center rounded-control bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-brand-600 hover:text-white"
          >
            Open board
          </Link>
        </div>
      </div>
    </article>
  );
}
