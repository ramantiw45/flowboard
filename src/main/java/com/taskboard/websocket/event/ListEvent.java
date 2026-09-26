package com.taskboard.websocket.event;

import com.taskboard.list.BoardList;
import com.taskboard.list.BoardList;

import java.util.UUID;

/**
 * List (column) state broadcast on create/rename/move/delete.
 * For LIST_DELETED only {@code listId} is populated.
 */
public record ListEvent(
        UUID listId,
        String name,
        Double position,
        Long version) {

    public static ListEvent fromList(BoardList list) {
        return new ListEvent(list.getId(), list.getName(), list.getPosition(), list.getVersion());
    }
}
