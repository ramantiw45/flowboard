package com.taskboard.activity;

import com.taskboard.activity.ActivityType;

import java.util.UUID;

/**
 * Domain event published inside transactions by board/list/card services.
 * ActivityLogService listens AFTER_COMMIT: it persists the ActivityLog row
 * and broadcasts an ActivityEvent to /topic/board/{boardId}.
 *
 * @param message   pre-rendered, human-readable text (e.g. "Alice moved 'X' to Done")
 * @param cardId    nullable — null for board/list level actions
 */
public record BoardActivityEvent(
        UUID boardId,
        UUID actorId,
        String actorName,
        ActivityType type,
        UUID cardId,
        String message) {

    public static BoardActivityEvent of(UUID boardId, UUID actorId, String actorName,
                                        ActivityType type, String message) {
        return new BoardActivityEvent(boardId, actorId, actorName, type, null, message);
    }

    public static BoardActivityEvent forCard(UUID boardId, UUID actorId, String actorName,
                                             ActivityType type, UUID cardId, String message) {
        return new BoardActivityEvent(boardId, actorId, actorName, type, cardId, message);
    }
}
