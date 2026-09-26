package com.taskboard.dto.card;

import com.taskboard.card.Card;

import java.time.Instant;
import java.util.UUID;

public record CardResponse(
        UUID id,
        UUID listId,
        String title,
        String description,
        String priority,
        double position,
        long version,
        Instant createdAt) {

    public static CardResponse from(Card card) {
        return new CardResponse(
                card.getId(),
                card.getList().getId(),
                card.getTitle(),
                card.getDescription(),
                card.getPriority().name(),
                card.getPosition(),
                card.getVersion(),
                card.getCreatedAt());
    }
}
