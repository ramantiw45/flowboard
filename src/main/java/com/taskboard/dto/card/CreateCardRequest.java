package com.taskboard.dto.card;

import com.taskboard.card.CardPriority;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateCardRequest(
        @NotBlank @Size(min = 1, max = 200) String title,
        @Size(max = 5000) String description,
        CardPriority priority) {

    public CardPriority effectivePriority() {
        return priority == null ? CardPriority.MEDIUM : priority;
    }
}
