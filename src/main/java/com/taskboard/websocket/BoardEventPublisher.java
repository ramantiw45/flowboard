package com.taskboard.websocket;

import com.taskboard.websocket.event.ActivityEvent;
import com.taskboard.websocket.event.BoardEvent;
import com.taskboard.websocket.event.EventType;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.UUID;

/**
 * Publishes board events to the STOMP broker topic /topic/board/{boardId}.
 *
 * Broadcasting is deferred to AFTER_COMMIT via a Spring application event:
 * clients never receive an event whose data is not yet visible in PostgreSQL,
 * which matters when a client reacts to an event by calling the REST API.
 */
@Component
@RequiredArgsConstructor
public class BoardEventPublisher {

    public static final String BOARD_TOPIC_PREFIX = "/topic/board/";

    private final SimpMessageSendingOperations messagingTemplate;
    private final ApplicationEventPublisher eventPublisher;

    /** Schedule a broadcast; sent only if/when the surrounding transaction commits. */
    public void broadcast(UUID boardId, EventType type, Object payload) {
        eventPublisher.publishEvent(new BoardRealtimeEvent(boardId, type, payload));
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onBoardRealtimeEvent(BoardRealtimeEvent event) {
        sendNow(event.boardId(), event.type(), event.payload());
    }

    private void sendNow(UUID boardId, EventType type, Object payload) {
        messagingTemplate.convertAndSend(
                BOARD_TOPIC_PREFIX + boardId,
                BoardEvent.of(type, boardId, payload));
    }
}
