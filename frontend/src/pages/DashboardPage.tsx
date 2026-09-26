import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FolderKanban, Plus, RefreshCw, Search } from 'lucide-react';
import { getBoards } from '../api/boardApi';
import { apiError } from '../api/client';
import type { BoardSummary } from '../types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import CreateBoardModal from '../components/dashboard/CreateBoardModal';
import BoardCard from '../components/dashboard/BoardCard';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { BoardCardSkeleton } from '../components/ui/Skeleton';

export default function DashboardPage() {
  const { user } = useAuth();
  const { push } = useToast();
  const [params, setParams] = useSearchParams();
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(params.get('new') === '1');

  /**
   * Re-fetchable board list.
   *
   * The previous version fetched once on mount and swallowed every error, so a
   * newly created board stayed invisible until a manual reload, and a network
   * failure was indistinguishable from an empty workspace.
   */
  const loadBoards = useCallback(async (notify = false) => {
    setLoading(true);
    try {
      setBoards(await getBoards());
      setLoadError(null);
    } catch (err) {
      setLoadError(apiError(err));
      if (notify) push(apiError(err), 'error');
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    void loadBoards();
  }, [loadBoards]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? boards.filter((b) => b.name.toLowerCase().includes(q)) : boards;
  }, [boards, query]);

  const closeCreate = () => {
    setCreateOpen(false);
    if (params.get('new')) {
      params.delete('new');
      setParams(params, { replace: true });
    }
  };

  const firstName = user?.displayName?.split(' ')[0] ?? 'there';

  return (
    <div className="thin-scrollbar flex-1 overflow-y-auto bg-slate-100">
      {/* Gradient page header keeps the dashboard from feeling flat */}
      <div className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-br from-brand-600 via-brand-500 to-violet-500">
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(rgba(255,255,255,0.7)_1px,transparent_1px)] [background-size:18px_18px]" />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-5 px-5 pb-16 pt-10 sm:px-8">
          <div>
            <p className="text-sm font-medium text-white/70">Workspace</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white sm:text-[1.75rem]">
              Welcome back, {firstName}
            </h1>
            <p className="mt-1.5 text-sm text-white/75">
              {loading
                ? 'Loading your boards…'
                : loadError
                  ? 'We could not reach the server.'
                  : boards.length === 0
                    ? 'Create your first board to start collaborating in real time.'
                  : `You have ${boards.length} board${boards.length === 1 ? '' : 's'} in this workspace.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              onClick={() => setCreateOpen(true)}
              icon={<Plus className="h-4 w-4" />}
              className="bg-white text-brand-700 shadow-card-hover hover:bg-white hover:text-brand-800"
            >
              New board
            </Button>
            <div className="relative min-w-[13rem] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search boards…"
                className="w-full rounded-lg border-0 bg-white/15 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/60 ring-1 ring-inset ring-white/25 backdrop-blur transition focus:bg-white/20 focus:ring-2 focus:ring-inset focus:ring-white/60"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 pb-14 sm:px-8">
        {loading ? (
          <div className="relative z-10 -mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <BoardCardSkeleton key={i} />
            ))}
          </div>
        ) : loadError ? (
          <div
            role="alert"
            className="card-surface flex flex-col items-center gap-3 px-6 py-10 text-center"
          >
            <p className="text-base font-bold text-slate-900">Could not load your boards</p>
            <p className="max-w-sm text-sm text-slate-500">{loadError}</p>
            <Button variant="secondary" onClick={() => void loadBoards(true)} icon={<RefreshCw className="h-4 w-4" />}>
              Try again
            </Button>
          </div>
        ) : boards.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No boards yet"
            description="Boards are where the work happens. Create one and we will set up To Do, In Progress and Done lists for you."
            action={
              <Button onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}>
                Create your first board
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title={`No boards match "${query.trim()}"`}
            description="Try a different search term, or clear the search to see every board."
            action={
              <Button variant="secondary" onClick={() => setQuery('')}>
                Clear search
              </Button>
            }
          />
        ) : (
          <div className="relative z-10 -mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((board) => (
              <BoardCard key={board.id} board={board} />
            ))}
          </div>
        )}
      </div>

      <CreateBoardModal
        open={createOpen}
        onClose={closeCreate}
        onCreated={() => {
          setCreateOpen(false);
          void loadBoards();
        }}
      />
    </div>
  );
}

