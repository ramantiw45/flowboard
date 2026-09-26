package com.taskboard.websocket.event;

import java.util.UUID;

/**
 * One activity-feed entry, broadcast alongside the persisted
 * ActivityLog row (see ActivityLogService).
 */
public record ActivityEvent(
        UUID id,
        UUID boardId,
        UUID actorId,
        String actorName,
        String type,
        UUID cardId,
        String message,
        java.time.Instant occurredAt) {
}
