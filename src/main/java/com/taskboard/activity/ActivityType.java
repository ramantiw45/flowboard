package com.taskboard.activity;

/**
 * Types of auditable board events. Each maps to one row in activity_logs
 * and one broadcast on /topic/board/{boardId}.
 */
public enum ActivityType {
    BOARD_CREATED,
    BOARD_RENAMED,
    MEMBER_INVITED,
    MEMBER_REMOVED,
    LIST_CREATED,
    LIST_RENAMED,
    LIST_DELETED,
    CARD_CREATED,
    CARD_UPDATED,
    CARD_MOVED,
    CARD_DELETED
}
