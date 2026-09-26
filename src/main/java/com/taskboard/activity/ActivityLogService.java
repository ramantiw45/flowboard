package com.taskboard.activity;

import com.taskboard.board.BoardRepository;
import com.taskboard.card.CardRepository;
import com.taskboard.user.UserRepository;
import com.taskboard.websocket.BoardEventPublisher;
import com.taskboard.websocket.event.ActivityEvent;
import com.taskboard.websocket.event.EventType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Event-driven activity journal. Listens for {@link BoardActivityEvent}
 * AFTER the originating transaction commits, then (in its own transaction):
 *  1. persists the ActivityLog row to PostgreSQL,
 *  2. broadcasts an ActivityEvent on /topic/board/{boardId}.
 *
 * AFTER_COMMIT + REQUIRES_NEW guarantees we only log durably-committed
 * actions, and that a logging failure can never roll back user actions.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ActivityLogService {

    private final ActivityLogRepository activityLogRepository;
    private final BoardRepository boardRepository;
    private final UserRepository userRepository;
    private final CardRepository cardRepository;
    private final BoardEventPublisher boardEventPublisher;
    private final com.taskboard.service.BoardAccessGuard accessGuard;

    /** Paginated activity feed for a board (member-only). */
    @Transactional(readOnly = true)
    public org.springframework.data.domain.Page<com.taskboard.dto.activity.ActivityLogResponse> getActivityFeed(
            java.util.UUID boardId, com.taskboard.security.UserPrincipal principal,
            org.springframework.data.domain.Pageable pageable) {
        accessGuard.assertMember(boardId, principal.getId());
        return activityLogRepository.findByBoardIdOrderByCreatedAtDesc(boardId, pageable)
                .map(com.taskboard.dto.activity.ActivityLogResponse::from);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onBoardActivity(BoardActivityEvent event) {
        try {
            // saveAndFlush: @UuidGenerator defers the INSERT, so created_at (and id) are
            // only populated on flush — the broadcast below needs the real timestamp.
            ActivityLog activityLog = activityLogRepository.saveAndFlush(ActivityLog.builder()
                    .board(boardRepository.getReferenceById(event.boardId()))
                    .actor(userRepository.getReferenceById(event.actorId()))
                    .card(event.cardId() != null
                            ? cardRepository.getReferenceById(event.cardId())
                            : null)
                    .type(event.type())
                    .message(event.message())
                    .build());

            boardEventPublisher.broadcast(event.boardId(), EventType.ACTIVITY, new ActivityEvent(
                    activityLog.getId(),
                    event.boardId(),
                    event.actorId(),
                    event.actorName(),
                    event.type().name(),
                    event.cardId(),
                    event.message(),
                    activityLog.getCreatedAt()));
        } catch (Exception ex) {
            // Never propagate: activity logging must not disrupt the user flow.
            log.error("Failed to persist activity log for board {}", event.boardId(), ex);
        }
    }
}
