import { useCallback, useEffect, useRef, useState } from 'react';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { useNavigate, useParams } from 'react-router-dom';
import { CircleSlash } from 'lucide-react';
import * as boardApi from '../api/boardApi';
import * as cardApi from '../api/cardApi';
import { apiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useWebSocket } from '../context/WebSocketContext';
import { mergeOlderPage, prependActivity } from '../utils/activityFeed';
import { applyRemoteCardMove, moveCardOptimistic } from '../utils/boardState';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { ListSkeleton } from '../components/ui/Skeleton';
import BoardHeader from '../components/board/BoardHeader';
import ListColumn from '../components/board/ListColumn';
import AddListForm from '../components/board/AddListForm';
import CardDetailsModal from '../components/board/CardDetailsModal';
import ActivityFeed from '../components/board/ActivityFeed';
import InviteMemberModal from '../components/board/InviteMemberModal';
import type {
  ActivityEvent,
  ActivityItem,
  BoardEvent,
  BoardMember,
  CardData,
  CardDeletedEvent,
  CardMoveEvent,
  CardStateEvent,
  ListData,
  ListEvent,
} from '../types';

export default function BoardPage() {
  const { boardId = '' } = useParams();
  const { connected, subscribeBoard } = useWebSocket();
  const { push } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [boardName, setBoardName] = useState('');
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [lists, setLists] = useState<ListData[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  /** Page index of the next older slice, or null when history is exhausted. */
  const [nextActivityPage, setNextActivityPage] = useState<number | null>(0);
  const [loadingMoreActivity, setLoadingMoreActivity] = useState(false);
  const [feedOpen, setFeedOpen] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Synchronous mirror of `lists`. A drag snapshots this so it can restore
   * the exact pre-drag state. The previous single shared "previous lists" ref
   * was overwritten by overlapping drags, so one failed drag could revert
   * another's change.
   */
  const listsRef = useRef<ListData[]>([]);
  useEffect(() => {
    listsRef.current = lists;
  }, [lists]);

  /** Pull authoritative board state; used after a lost race or a reconnect. */
  const resync = useCallback(async () => {
    try {
      const detail = await boardApi.getBoard(boardId);
      setBoardName(detail.name);
      setMembers(detail.members);
      setLists(detail.lists);
    } catch (err) {
      push(apiError(err), 'error');
    }
  }, [boardId, push]);

  // ---------- initial load ----------
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    boardApi
      .getBoard(boardId)
      .then((detail) => {
        if (cancelled) return;
        setBoardName(detail.name);
        setMembers(detail.members);
        setLists(detail.lists);
        listsRef.current = detail.lists;
      })
      .catch((err) => {
        if (cancelled) return;
        push(apiError(err), 'error');
        navigate('/boards');
      })
      .finally(() => !cancelled && setLoading(false));

    // The activity feed is decorative: its failure must not blank the board.
    boardApi
      .getActivityPage(boardId)
      .then((page) => {
        if (cancelled) return;
        setActivity(page.items);
        setNextActivityPage(page.nextPage);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [boardId, push, navigate]);

  // ---------- resync on reconnect ----------
  // Events broadcast while the socket was down are lost, and some handlers
  // silently ignore events for cards they do not know about, so a dropped
  // connection leaves the board stale until a manual reload. Refetch on every
  // reconnect (but not on the first one, which the initial load covers).
  const skipFirstConnectRef = useRef(true);
  useEffect(() => {
    if (!connected) {
      skipFirstConnectRef.current = true;
      return;
    }
    if (skipFirstConnectRef.current) {
      skipFirstConnectRef.current = false;
      return;
    }
    void resync();
  }, [connected, resync]);

  // ---------- real-time event application ----------
  const applyEvent = useCallback((event: BoardEvent) => {
    switch (event.type) {
      case 'ACTIVITY': {
        const p = event.payload as ActivityEvent;
        const item: ActivityItem = {
          id: p.id,
          actorId: p.actorId,
          actorName: p.actorName,
          type: p.type,
          cardId: p.cardId,
          message: p.message,
          // Fall back to the envelope timestamp if the payload omits it.
          at: p.occurredAt ?? event.occurredAt,
        };
        setActivity((prev) => prependActivity(prev, item));
        break;
      }
      case 'CARD_CREATED': {
        const p = event.payload as CardStateEvent;
        setLists((prev) =>
          prev.map((l) =>
            l.id === p.listId && !l.cards.some((c) => c.id === p.cardId)
              ? {
                  ...l,
                  cards: [...l.cards, {
                    id: p.cardId, listId: p.listId, title: p.title, description: p.description,
                    priority: p.priority, position: p.position, version: p.version,
                    createdAt: event.occurredAt,
                  }].sort((a, b) => a.position - b.position),
                }
              : l
          )
        );
        break;
      }
      case 'CARD_UPDATED': {
        const p = event.payload as CardStateEvent;
        setLists((prev) =>
          prev.map((l) => ({
            ...l,
            cards: l.cards.map((c) =>
              c.id === p.cardId
                ? { ...c, title: p.title, description: p.description, priority: p.priority, position: p.position, version: p.version }
                : c
            ),
          }))
        );
        break;
      }
      case 'CARD_MOVED':
        setLists((prev) => applyRemoteCardMove(prev, event.payload as CardMoveEvent));
        break;
      case 'CARD_DELETED': {
        const p = event.payload as CardDeletedEvent;
        setLists((prev) =>
          prev.map((l) => (l.id === p.listId ? { ...l, cards: l.cards.filter((c) => c.id !== p.cardId) } : l))
        );
        break;
      }
      case 'LIST_CREATED':
      case 'LIST_UPDATED': {
        const p = event.payload as ListEvent;
        if (!p.name || p.position == null) break;
        setLists((prev) => {
          const exists = prev.some((l) => l.id === p.listId);
          const updated = exists
            ? prev.map((l) =>
                l.id === p.listId
                  ? { ...l, name: p.name ?? l.name, position: p.position ?? l.position, version: p.version ?? l.version }
                  : l
              )
            : [...prev, { id: p.listId, name: p.name ?? '', position: p.position ?? 0, version: p.version ?? 0, cards: [] }];
          return updated.sort((a, b) => a.position - b.position);
        });
        break;
      }
      case 'LIST_DELETED': {
        const p = event.payload as ListEvent;
        setLists((prev) => prev.filter((l) => l.id !== p.listId));
        break;
      }
      case 'MEMBER_ADDED': {
        const m = event.payload as BoardMember;
        setMembers((prev) => (prev.some((x) => x.userId === m.userId) ? prev : [...prev, m]));
        break;
      }
      case 'MEMBER_UPDATED': {
        // A role change: replace the entry so the owner's role controls and
        // the header avatar stack reflect the new privilege immediately.
        const m = event.payload as BoardMember;
        setMembers((prev) => prev.map((x) => (x.userId === m.userId ? m : x)));
        break;
      }
      default:
        break;
    }
  }, []);

  const handlerRef = useRef(applyEvent);
  useEffect(() => {
    handlerRef.current = applyEvent;
  }, [applyEvent]);

  // ---------- real-time subscription ----------
  useEffect(() => {
    return subscribeBoard(boardId, (event) => handlerRef.current(event));
  }, [boardId, subscribeBoard]);

  // ---------- column reordering (drag, and the keyboard nudge) ----------
  const moveList = useCallback(
    async (listId: string, targetIndex: number) => {
      const prev = listsRef.current;
      const index = prev.findIndex((l) => l.id === listId);
      if (index === -1) return;
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(Math.max(0, Math.min(targetIndex, next.length)), 0, moved);
      listsRef.current = next;
      setLists(next);
      try {
        await boardApi.moveList(boardId, listId, targetIndex);
      } catch (err) {
        listsRef.current = prev;
        setLists(prev);
        push(apiError(err), 'error');
        void resync();
      }
    },
    [boardId, push, resync]
  );

  /** Arrow-key equivalent of dragging a column by its grip. */
  const handleNudgeList = useCallback(
    async (listId: string, direction: -1 | 1) => {
      const current = listsRef.current;
      const index = current.findIndex((l) => l.id === listId);
      if (index === -1) return;
      const target = index + direction;
      if (target < 0 || target >= current.length) return;
      await moveList(listId, target);
    },
    [moveList]
  );

  // ---------- card drag & drop: optimistic -> PATCH -> revert + resync on error ----------
  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      const { source, destination, type, draggableId } = result;
      if (!destination) return;
      if (source.droppableId === destination.droppableId && source.index === destination.index) {
        return;
      }

      if (type === 'LIST') {
        await moveList(draggableId, destination.index);
        return;
      }

      // CARD drag ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â hello-pangea destination.index is relative to the list
      // after removal, which exactly matches the backend's targetIndex
      // (slot among the other cards).
      const fromListId = source.droppableId;
      const toListId = destination.droppableId;
      const prev = listsRef.current;
      const next = moveCardOptimistic(prev, fromListId, toListId, source.index, destination.index);
      listsRef.current = next;
      setLists(next);
      try {
        await cardApi.moveCard(boardId, draggableId, {
          toListId,
          targetIndex: destination.index,
        });
      } catch (err) {
        // Restore the pre-drag snapshot, then re-read the server: a 409 means
        // someone else won the race, and a local revert alone would leave this
        // client permanently out of step with everyone else.
        listsRef.current = prev;
        setLists(prev);
        push(apiError(err), 'error');
        void resync();
      }
    },
    [boardId, push, moveList, resync]
  );

  // ---------- CRUD actions (server echo via WebSocket reconciles all clients) ----------
  const handleAddCard = useCallback(
    async (listId: string, title: string) => {
      try {
        const card = await cardApi.createCard(boardId, listId, { title });
        setLists((prev) =>
          prev.map((l) =>
            l.id === listId && !l.cards.some((c) => c.id === card.id)
              ? { ...l, cards: [...l.cards, card].sort((a, b) => a.position - b.position) }
              : l
          )
        );
      } catch (err) {
        push(apiError(err), 'error');
      }
    },
    [boardId, push]
  );

  /**
   * Fetches the next slice of older history. The feed was previously capped at
   * a single page with no way to reach anything behind it; paging is manual so
   * a busy board does not refetch history nobody scrolls to.
   */
  const handleLoadMoreActivity = useCallback(async () => {
    if (nextActivityPage === null || loadingMoreActivity) return;
    setLoadingMoreActivity(true);
    try {
      const page = await boardApi.getActivityPage(boardId, nextActivityPage);
      setActivity((prev) => mergeOlderPage(prev, page.items));
      setNextActivityPage(page.nextPage);
    } catch (err) {
      push(apiError(err), 'error');
    } finally {
      setLoadingMoreActivity(false);
    }
  }, [boardId, nextActivityPage, loadingMoreActivity, push]);

  const handleCreateList = useCallback(
    async (name: string) => {
      try {
        const list = await boardApi.createList(boardId, name);
        setLists((prev) =>
          prev.some((l) => l.id === list.id)
            ? prev
            : [...prev, list].sort((a, b) => a.position - b.position)
        );
      } catch (err) {
        push(apiError(err), 'error');
      }
    },
    [boardId, push]
  );

  const handleRenameList = useCallback(
    async (listId: string, name: string) => {
      try {
        await boardApi.renameList(boardId, listId, name);
        setLists((prev) => prev.map((l) => (l.id === listId ? { ...l, name } : l)));
      } catch (err) {
        push(apiError(err), 'error');
      }
    },
    [boardId, push]
  );

  const handleDeleteList = useCallback(
    async (listId: string) => {
      try {
        await boardApi.deleteList(boardId, listId);
        setLists((prev) => prev.filter((l) => l.id !== listId));
      } catch (err) {
        push(apiError(err), 'error');
      }
    },
    [boardId, push]
  );

  const handleSaveCard = useCallback(
    async (
      cardId: string,
      patch: { title?: string; description?: string; priority?: CardData['priority'] }
    ) => {
      try {
        const updated = await cardApi.updateCard(boardId, cardId, patch);
        setLists((prev) =>
          prev.map((l) => ({
            ...l,
            cards: l.cards.map((c) => (c.id === cardId ? updated : c)),
          }))
        );
      } catch (err) {
        push(apiError(err), 'error');
      }
    },
    [boardId, push]
  );

  const handleDeleteCard = useCallback(
    async (cardId: string) => {
      try {
        await cardApi.deleteCard(boardId, cardId);
        setLists((prev) =>
          prev.map((l) => ({ ...l, cards: l.cards.filter((c) => c.id !== cardId) }))
        );
      } catch (err) {
        push(apiError(err), 'error');
      }
    },
    [boardId, push]
  );

  // ---------- render ----------
  if (loading) {
    return (
      <div className="board-canvas flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-slate-950/40 px-4 py-3 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="skeleton h-4 w-36 bg-white/15" />
            <div className="skeleton h-5 w-20 rounded-full bg-white/10" />
          </div>
          <div className="flex items-center gap-2">
            <div className="skeleton h-7 w-24 rounded-full bg-white/10" />
            <div className="skeleton h-7 w-7 rounded-full bg-white/10" />
          </div>
        </div>
        <div className="thin-scrollbar-light flex flex-1 items-start gap-4 overflow-x-auto p-4">
          {[0, 1, 2, 3].map((i) => (
            <ListSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }
  if (!boardName) {
    return (
      <div className="board-canvas flex min-h-0 flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">
          <EmptyState
            icon={CircleSlash}
            tone="dark"
            title="Board unavailable"
            description="This board does not exist, or you are not a member of it. Ask an owner to invite you, then reload."
            action={
              <Button variant="glass" onClick={() => navigate('/boards')}>
                Back to my boards
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="board-canvas flex min-h-0 flex-1 flex-col">
      <BoardHeader
        boardName={boardName}
        members={members}
        connected={connected}
        feedOpen={feedOpen}
        onToggleFeed={() => setFeedOpen((v) => !v)}
        onInvite={() => setInviteOpen(true)}
      />

      <div className="flex min-h-0 flex-1">
        <DragDropContext onDragEnd={handleDragEnd}>
          {/* Single scroll parent for the vertical axis: `overflow-y: hidden`
              keeps the whole board from growing, so each column's Droppable is
              the only vertical scroll container (the library warns about
              nested scroll containers). `h-full` + `items-stretch` give the
              columns a definite height so `max-h-full` and internal scrolling
              actually engage instead of collapsing to auto. */}
          <div className="thin-scrollbar-light flex h-full min-h-0 flex-1 items-start gap-4 overflow-x-auto overflow-y-hidden p-4">
            <Droppable droppableId="board" direction="horizontal" type="LIST">
              {(dropProvided) => (
                <div
                  ref={dropProvided.innerRef}
                  {...dropProvided.droppableProps}
                  className="flex h-full min-h-0 items-stretch gap-4"
                >
                  {lists.map((list, index) => (
                    <Draggable key={list.id} draggableId={list.id} index={index}>
                      {(dragProvided, dragSnapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          className={`flex h-full min-h-0 ${dragSnapshot.isDragging ? 'drop-shadow-2xl' : ''}`}
                        >
                          <ListColumn
                            list={list}
                            headerDragHandleProps={dragProvided.dragHandleProps}
                            onAddCard={handleAddCard}
                            onRenameList={handleRenameList}
                            onDeleteList={handleDeleteList}
                            onNudgeList={handleNudgeList}
                            onOpenCard={setSelectedCard}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {dropProvided.placeholder}
                </div>
              )}
            </Droppable>

            {lists.length === 0 && (
              <div className="flex w-[19rem] shrink-0 flex-col items-center gap-1 rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-6 text-center">
                <p className="text-sm font-semibold text-white">No lists yet</p>
                <p className="text-xs leading-relaxed text-slate-400">
                  Lists are the columns of your board. Start with one below.
                </p>
              </div>
            )}

            <AddListForm onCreate={handleCreateList} />
          </div>
        </DragDropContext>

        <ActivityFeed
          open={feedOpen}
          activity={activity}
          loadingMore={loadingMoreActivity}
          hasMore={nextActivityPage !== null}
          onLoadMore={() => void handleLoadMoreActivity()}
          onClose={() => setFeedOpen(false)}
        />
      </div>

      {selectedCard && (
        <CardDetailsModal
          key={selectedCard.id}
          card={selectedCard}
          activity={activity}
          onClose={() => setSelectedCard(null)}
          onSave={handleSaveCard}
          onDelete={handleDeleteCard}
        />
      )}

      <InviteMemberModal
        open={inviteOpen}
        boardId={boardId}
        members={members}
        currentUserId={user?.id ?? null}
        onClose={() => setInviteOpen(false)}
      />
    </div>
  );
}
