package com.taskboard.dto.card;

import com.taskboard.card.CardPriority;
import jakarta.validation.constraints.Size;

/**
 * Partial update — null fields are left unchanged.
 *
 * <p>Constraints mirror {@link CreateCardRequest}. Without them an oversized
 * title reached PostgreSQL and surfaced as a 500 (varchar(200) violation)
 * instead of a 400.
 */
public record UpdateCardRequest(
        @Size(min = 1, max = 200) String title,
        @Size(max = 5000) String description,
        CardPriority priority) {
}