package com.taskboard.websocket.event;

import java.util.UUID;

/**
 * Emitted when a card is dragged into another list or reordered within
 * its list. Clients apply the move optimistically and reconcile on
 * {@code version} (optimistic-lock counter).
 *
 * @param cardId      the moved card
 * @param fromListId  list the card came from (== toListId for in-list reorders)
 * @param toListId    list the card now lives in
 * @param newPosition fractional order index in the target list
 * @param actorId     user who performed the move (clients ignore their own echo)
 * @param version     card version AFTER the persisted move
 */
public record CardMoveEvent(
        UUID cardId,
        UUID fromListId,
        UUID toListId,
        double newPosition,
        UUID actorId,
        long version) {
}
