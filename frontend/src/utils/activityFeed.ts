import type { ActivityItem } from '../types';

/**
 * Ceiling on how many activity rows the client keeps in memory. Live events
 * keep prepending, so without a bound a long-lived tab grows without limit.
 * Older history stays reachable through paging; this only caps the buffer.
 */
export const ACTIVITY_BUFFER_LIMIT = 300;

/**
 * Prepends a freshly fetched page of older history onto what is already
 * loaded, dropping any id that is already present.
 *
 * The feed is newest-first, so an older page belongs *below* what we have.
 * Ids are deduped because a live ACTIVITY event can arrive for a row that a
 * concurrent page fetch also returned, which would otherwise render a
 * duplicate React key.
 */
export function mergeOlderPage(current: ActivityItem[], older: ActivityItem[]): ActivityItem[] {
  if (older.length === 0) return current;
  const seen = new Set(current.map((item) => item.id));
  const fresh = older.filter((item) => !seen.has(item.id));
  if (fresh.length === 0) return current;
  return [...current, ...fresh];
}

/**
 * Inserts (or refreshes) a single live event at the head of the feed, keeping
 * the buffer bounded. Used for the WebSocket ACTIVITY push.
 */
export function prependActivity(
  current: ActivityItem[],
  incoming: ActivityItem,
  limit = ACTIVITY_BUFFER_LIMIT
): ActivityItem[] {
  const withoutDuplicate = current.filter((item) => item.id !== incoming.id);
  return [incoming, ...withoutDuplicate].slice(0, limit);
}
