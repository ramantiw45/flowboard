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

export async function inviteMember(boardId: string, email: string): Promise<BoardMember> {
  const { data } = await api.post<BoardMember>(`/boards/${boardId}/members`, { email });
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
export async function getActivity(boardId: string, page = 0, size = 30): Promise<ActivityItem[]> {
  const { data } = await api.get(`/boards/${boardId}/activity`, { params: { page, size } });
  return (data.content as Array<{
    id: string;
    actorId: string;
    actorName: string;
    type: string;
    cardId: string | null;
    message: string;
    createdAt: string;
  }>).map((a) => ({
    id: a.id,
    actorId: a.actorId,
    actorName: a.actorName,
    type: a.type,
    cardId: a.cardId,
    message: a.message,
    at: a.createdAt,
  }));
}
