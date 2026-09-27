import {
  Activity,
  History,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import Avatar from '../ui/Avatar';
import EmptyState from '../ui/EmptyState';
import { fullDate, timeAgo } from '../../utils/time';
import type { ActivityItem } from '../../types';

/** Small per-event glyph so the feed is scannable at a glance. */
const TYPE_ICONS: Record<string, LucideIcon> = {
  BOARD_CREATED: Sparkles,
  MEMBER_INVITED: UserPlus,
  MEMBER_REMOVED: Users,
  LIST_CREATED: Plus,
  LIST_RENAMED: Pencil,
  LIST_DELETED: Trash2,
  CARD_CREATED: Plus,
  CARD_UPDATED: Pencil,
  CARD_MOVED: Activity,
  CARD_DELETED: Trash2,
};

interface ActivityFeedProps {
  open: boolean;
  activity: ActivityItem[];
  /** True while an older page is in flight. */
  loadingMore: boolean;
  /** True when the server still has rows behind the last loaded page. */
  hasMore: boolean;
  onLoadMore: () => void;
  onClose: () => void;
}

export default function ActivityFeed({
  open,
  activity,
  loadingMore,
  hasMore,
  onLoadMore,
  onClose,
}: ActivityFeedProps) {
  if (!open) return null;

  return (
    <aside
      aria-label="Activity feed"
      className="z-panel flex w-80 shrink-0 flex-col border-l border-white/10 bg-slate-950/60 backdrop-blur-md"
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Activity</h2>
          {activity.length > 0 && (
            <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-micro font-bold text-slate-300 ring-1 ring-inset ring-white/10">
              {activity.length}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Close activity feed"
          className="-mr-1 rounded-control p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" strokeWidth={2.25} />
        </button>
      </div>

      <div className="thin-scrollbar-light flex-1 overflow-y-auto">
        {activity.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={History}
              tone="dark"
              title="No activity yet"
              description="Card moves, edits and new cards will appear here in real time."
            />
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {activity.map((item) => {
              const TypeIcon = TYPE_ICONS[item.type] ?? Activity;
              return (
                <li key={item.id} className="flex gap-3 px-4 py-3 transition hover:bg-white/5">
                  <Avatar name={item.actorName} size="sm" ring={false} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-white">
                        <TypeIcon className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
                        <span className="truncate">{item.actorName}</span>
                      </p>
                      <time
                        dateTime={item.at}
                        title={fullDate(item.at)}
                        className="shrink-0 text-micro text-slate-500"
                      >
                        {timeAgo(item.at)}
                      </time>
                    </div>
                    <p className="mt-0.5 text-sm leading-snug text-slate-300">{item.message}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {activity.length > 0 && hasMore && (
          <div className="border-t border-white/5 p-3">
            <button
              onClick={onLoadMore}
              disabled={loadingMore}
              className="w-full rounded-control py-1.5 text-xs font-medium text-slate-400 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              {loadingMore ? 'Loading…' : 'Load older activity'}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
