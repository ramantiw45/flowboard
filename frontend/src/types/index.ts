// ---------- Auth / Users ----------
export interface UserResponse {
  id: string;
  email: string;
  displayName: string;
  createdAt?: string | null;
}

export interface AuthResponse {
  token: string;
  tokenType: string;
  user: UserResponse;
}

// ---------- Users ----------
export type MemberRole = 'OWNER' | 'ADMIN' | 'MEMBER';

// ---------- Boards ----------
export interface BoardSummary {
  id: string;
  name: string;
  ownerName: string;
  createdAt: string;
}

export interface BoardMember {
  userId: string;
  email: string;
  displayName: string;
  role: MemberRole;
}

/** Roles a client may assign. OWNER is fixed at board creation and never assignable. */
export type AssignableRole = Exclude<MemberRole, 'OWNER'>;

export interface CardData {
  id: string;
  listId: string;
  title: string;
  description: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  position: number;
  version: number;
  createdAt: string;
}

export interface ListData {
  id: string;
  name: string;
  position: number;
  version: number;
  cards: CardData[];
}

export interface BoardDetail {
  id: string;
  name: string;
  lists: ListData[];
  members: BoardMember[];
  createdAt: string;
  updatedAt: string;
}

// ---------- Activity ----------
export interface ActivityItem {
  id: string;
  actorId: string;
  actorName: string;
  type: string;
  cardId: string | null;
  message: string;
  at: string;
}

// ---------- WebSocket events (mirrors backend websocket.event.*) ----------
export type EventType =
  | 'CARD_CREATED'
  | 'CARD_UPDATED'
  | 'CARD_MOVED'
  | 'CARD_DELETED'
  | 'LIST_CREATED'
  | 'LIST_UPDATED'
  | 'LIST_DELETED'
  | 'MEMBER_ADDED'
  | 'MEMBER_REMOVED'
  | 'MEMBER_UPDATED'
  | 'ACTIVITY';

export interface BoardEvent<T = unknown> {
  type: EventType;
  boardId: string;
  payload: T;
  occurredAt: string;
}

export interface CardMoveEvent {
  cardId: string;
  fromListId: string;
  toListId: string;
  newPosition: number;
  actorId: string;
  version: number;
}

export interface CardStateEvent {
  cardId: string;
  listId: string;
  title: string;
  description: string | null;
  priority: CardData['priority'];
  position: number;
  version: number;
}

export interface CardDeletedEvent {
  cardId: string;
  listId: string;
}

export interface ListEvent {
  listId: string;
  name: string | null;
  position: number | null;
  version: number | null;
}

export interface ActivityEvent {
  id: string;
  boardId: string;
  actorId: string;
  actorName: string;
  type: string;
  cardId: string | null;
  message: string;
  occurredAt: string;
}
