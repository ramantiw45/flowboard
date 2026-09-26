import { api } from './client';
import type { CardData } from '../types';

export interface CreateCardPayload {
  title: string;
  description?: string;
  priority?: CardData['priority'];
}

export interface UpdateCardPayload {
  title?: string;
  description?: string;
  priority?: CardData['priority'];
}

export interface MoveCardPayload {
  toListId: string;
  targetIndex: number;
}

export async function createCard(
  boardId: string,
  listId: string,
  payload: CreateCardPayload
): Promise<CardData> {
  const { data } = await api.post<CardData>(`/boards/${boardId}/lists/${listId}/cards`, payload);
  return data;
}

export async function updateCard(
  boardId: string,
  cardId: string,
  payload: UpdateCardPayload
): Promise<CardData> {
  const { data } = await api.patch<CardData>(`/boards/${boardId}/cards/${cardId}`, payload);
  return data;
}

export async function moveCard(
  boardId: string,
  cardId: string,
  payload: MoveCardPayload
): Promise<CardData> {
  const { data } = await api.patch<CardData>(`/boards/${boardId}/cards/${cardId}/move`, payload);
  return data;
}

export async function deleteCard(boardId: string, cardId: string): Promise<void> {
  await api.delete(`/boards/${boardId}/cards/${cardId}`);
}
