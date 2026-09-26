package com.taskboard.websocket.event;

/**
 * Real-time event types broadcast on /topic/board/{boardId}.
 * The client switch-cases on this to patch its local state.
 */
public enum EventType {
    CARD_CREATED,
    CARD_UPDATED,
    CARD_MOVED,
    CARD_DELETED,
    LIST_CREATED,
    LIST_UPDATED,
    LIST_DELETED,
    MEMBER_ADDED,
    MEMBER_REMOVED,
    ACTIVITY
}
