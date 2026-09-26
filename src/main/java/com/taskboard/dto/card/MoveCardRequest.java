package com.taskboard.dto.card;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

/**
 * Drag-and-drop move request.
 *
 * @param toListId    target list (may equal the card's current list)
 * @param targetIndex 0-based slot among the target list's cards; null = append at end
 */
public record MoveCardRequest(
        @NotNull UUID toListId,
        Integer targetIndex) {
}
