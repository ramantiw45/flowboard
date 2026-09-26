import type { CardData, CardMoveEvent, ListData } from '../types';

/** Sorts cards by their fractional position index. */
export function sortCards(cards: CardData[]): CardData[] {
  return [...cards].sort((a, b) => a.position - b.position);
}

/** Sorts lists (columns) by their fractional position index. */
export function sortLists(lists: ListData[]): ListData[] {
  return [...lists].sort((a, b) => a.position - b.position);
}

/**
 * Optimistic drag: removes the card from the source list and inserts it at
 * the destination index (hello-pangea/dnd semantics — the index is relative
 * to the list *after* removal). Mutates nothing; returns a new array.
 */
export function moveCardOptimistic(
  lists: ListData[],
  fromListId: string,
  toListId: string,
  sourceIndex: number,
  destIndex: number
): ListData[] {
  const source = lists.find((l) => l.id === fromListId);
  const card = source?.cards[sourceIndex];
  if (!source || !card) return lists;

  return lists.map((list) => {
    if (list.id === fromListId && list.id === toListId) {
      const cards = [...list.cards];
      cards.splice(sourceIndex, 1);
      cards.splice(destIndex, 0, { ...card, listId: toListId });
      return { ...list, cards };
    }
    if (list.id === fromListId) {
      return { ...list, cards: list.cards.filter((_, i) => i !== sourceIndex) };
    }
    if (list.id === toListId) {
      const cards = [...list.cards];
      cards.splice(destIndex, 0, { ...card, listId: toListId });
      return { ...list, cards };
    }
    return list;
  });
}

/**
 * Reconciles a CARD_MOVED broadcast (own echo or remote user). The payload
 * carries the authoritative fractional position, so the correct insertion
 * index among the remaining cards is simply how many have a smaller position.
 */
export function applyRemoteCardMove(lists: ListData[], ev: CardMoveEvent): ListData[] {
  const moved = lists
    .find((l) => l.id === ev.fromListId)
    ?.cards.find((c) => c.id === ev.cardId);
  if (!moved) return lists;

  const stripped = lists.map((l) =>
    l.id === ev.fromListId ? { ...l, cards: l.cards.filter((c) => c.id !== ev.cardId) } : l
  );

  return stripped.map((l) => {
    if (l.id !== ev.toListId) return l;
    const cards = sortCards(l.cards);
    const insertIdx = cards.filter((c) => c.position < ev.newPosition).length;
    cards.splice(insertIdx, 0, {
      ...moved,
      listId: ev.toListId,
      position: ev.newPosition,
      version: ev.version,
    });
    return { ...l, cards };
  });
}
