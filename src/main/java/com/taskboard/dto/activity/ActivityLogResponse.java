package com.taskboard.dto.activity;

import com.taskboard.activity.ActivityLog;

import java.time.Instant;
import java.util.UUID;

public record ActivityLogResponse(
        UUID id,
        String actorId,
        String actorName,
        String type,
        String cardId,
        String message,
        Instant createdAt) {

    public static ActivityLogResponse from(ActivityLog log) {
        return new ActivityLogResponse(
                log.getId(),
                log.getActor().getId().toString(),
                log.getActor().getDisplayName(),
                log.getType().name(),
                log.getCard() != null ? log.getCard().getId().toString() : null,
                log.getMessage(),
                log.getCreatedAt());
    }
}
