package com.taskboard.websocket.event;

import java.util.UUID;

public record CardDeletedEvent(UUID cardId, UUID listId) {
}
