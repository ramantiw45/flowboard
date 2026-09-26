import { api } from './client';
import type { ActivityItem, BoardDetail, BoardMember, BoardSummary, ListData } from '../types';

// ---------- Boards ----------
export async function getBoards(): Promise<BoardSummary[]> {
  const { data } = await api.get<BoardSummary[]>('/boards');
  return data;
}

export async function createBoard(name: string): Promise<BoardSummary> {
  const { data } = await api.post<BoardSummary>('/boards', { name });
  return data;
}

export async function getBoard(boardId: string): Promise<BoardDetail> {
  const { data } = await api.get<BoardDetail>(`/boards/${boardId}`);
  return data;
}

export async function inviteMember(
  boardId: string,
  email: string,
  role: BoardMember['role'] = 'MEMBER'
): Promise<BoardMember> {
  const { data } = await api.post<BoardMember>(`/boards/${boardId}/members`, { email, role });
  return data;
}

/** Owner-only. Promotes or demotes an existing member between ADMIN and MEMBER. */
export async function changeMemberRole(
  boardId: string,
  userId: string,
  role: BoardMember['role']
): Promise<BoardMember> {
  const { data } = await api.patch<BoardMember>(`/boards/${boardId}/members/${userId}/role`, { role });
  return data;
}

export async function getMembers(boardId: string): Promise<BoardMember[]> {
  const { data } = await api.get<BoardMember[]>(`/boards/${boardId}/members`);
  return data;
}

// ---------- Lists ----------
export async function createList(boardId: string, name: string): Promise<ListData> {
  const { data } = await api.post<ListData>(`/boards/${boardId}/lists`, { name });
  return data;
}

export async function renameList(boardId: string, listId: string, name: string): Promise<ListData> {
  const { data } = await api.patch<ListData>(`/boards/${boardId}/lists/${listId}`, { name });
  return data;
}

export async function moveList(boardId: string, listId: string, targetIndex: number): Promise<ListData> {
  const { data } = await api.patch<ListData>(`/boards/${boardId}/lists/${listId}/move`, { targetIndex });
  return data;
}

export async function deleteList(boardId: string, listId: string): Promise<void> {
  await api.delete(`/boards/${boardId}/lists/${listId}`);
}

// ---------- Activity ----------
/** Rows fetched per page. The backend caps `size` at 100. */
export const ACTIVITY_PAGE_SIZE = 30;

export interface ActivityPage {
  items: ActivityItem[];
  /** True when the server has more rows behind this page. */
  hasMore: boolean;
  /** Page index to request next, or null when the feed is fully loaded. */
  nextPage: number | null;
  /** Total rows on the board, for a "1-30 of 44" style footer. */
  total: number;
}

function toActivityItem(a: {
  id: string;
  actorId: string;
  actorName: string;
  type: string;
  cardId: string | null;
  message: string;
  createdAt: string;
}): ActivityItem {
  return {
    id: a.id,
    actorId: a.actorId,
    actorName: a.actorName,
    type: a.type,
    cardId: a.cardId,
    message: a.message,
    at: a.createdAt,
  };
}

/** Raw wire shape of the activity page envelope (see ActivityPageResponse). */
interface ActivityPageResponse {
  items: Parameters<typeof toActivityItem>[0][];
  hasMore: boolean;
  nextPage: number | null;
  total: number;
}

export async function getActivityPage(
  boardId: string,
  page = 0,
  size = ACTIVITY_PAGE_SIZE
): Promise<ActivityPage> {
  // Field names are the server's explicit ActivityPageResponse contract, not
  // Spring's PageImpl serialisation.
  const { data } = await api.get(`/boards/${boardId}/activity`, {
    params: { page, size },
  }) as { data: ActivityPageResponse };
  return {
    items: data.items.map(toActivityItem),
    hasMore: data.hasMore,
    nextPage: data.nextPage,
    total: data.total,
  };
}

export async function getActivity(boardId: string, size = ACTIVITY_PAGE_SIZE): Promise<ActivityItem[]> {
  const { items } = await getActivityPage(boardId, 0, size);
  return items;
}
