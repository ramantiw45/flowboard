package com.taskboard.websocket.event;

import java.util.UUID;
import com.taskboard.card.Card;

/**
 * Full card state, broadcast on create/update so late-joining or
 * lagging clients can upsert the card directly.
 */
public record CardStateEvent(
        UUID cardId,
        UUID listId,
        String title,
        String description,
        String priority,
        double position,
        long version) {

    public static CardStateEvent fromCard(com.taskboard.card.Card card) {
        return new CardStateEvent(
                card.getId(),
                card.getList().getId(),
                card.getTitle(),
                card.getDescription(),
                card.getPriority().name(),
                card.getPosition(),
                card.getVersion());
    }
}
