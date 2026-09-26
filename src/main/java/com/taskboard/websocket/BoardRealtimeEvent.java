package com.taskboard.websocket;

import com.taskboard.websocket.event.EventType;

import java.util.UUID;

/**
 * Internal Spring application event carrying a pending STOMP broadcast.
 * Published inside transactions and delivered to BoardEventPublisher
 * AFTER_COMMIT, guaranteeing clients are only notified of persisted state.
 */
public record BoardRealtimeEvent(UUID boardId, EventType type, Object payload) {
}
