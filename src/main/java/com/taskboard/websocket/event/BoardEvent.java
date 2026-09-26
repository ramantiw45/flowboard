package com.taskboard.websocket.event;

import java.time.Instant;
import java.util.UUID;

/**
 * Envelope broadcast to /topic/board/{boardId}:
 * <pre>{ "type": "CARD_MOVED", "boardId": "...", "payload": { ... }, "occurredAt": "..." }</pre>
 * The payload shape depends on {@link EventType}.
 */
public record BoardEvent(EventType type, UUID boardId, Object payload, Instant occurredAt) {

    public static BoardEvent of(EventType type, UUID boardId, Object payload) {
        return new BoardEvent(type, boardId, payload, Instant.now());
    }
}
