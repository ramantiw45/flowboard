package com.taskboard.service;

import com.taskboard.activity.ActivityType;
import com.taskboard.activity.BoardActivityEvent;
import com.taskboard.card.Card;
import com.taskboard.card.CardRepository;
import com.taskboard.common.exception.ResourceNotFoundException;
import com.taskboard.dto.card.CardResponse;
import com.taskboard.dto.card.CreateCardRequest;
import com.taskboard.dto.card.MoveCardRequest;
import com.taskboard.dto.card.UpdateCardRequest;
import com.taskboard.list.BoardList;
import com.taskboard.list.BoardListRepository;
import com.taskboard.security.UserPrincipal;
import com.taskboard.websocket.BoardEventPublisher;
import com.taskboard.websocket.event.CardDeletedEvent;
import com.taskboard.websocket.event.CardMoveEvent;
import com.taskboard.websocket.event.CardStateEvent;
import com.taskboard.websocket.event.EventType;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Card operations. Every mutation runs in one transaction that:
 *  1. enforces board membership via BoardAccessGuard,
 *  2. persists the change (fractional positions, optimistic @Version),
 *  3. defers WebSocket broadcasts + activity logging to AFTER_COMMIT.
 */
@Service
@RequiredArgsConstructor
public class CardService {

    private static final double POSITION_STEP = 1000.0;

    private final CardRepository cardRepository;
    private final BoardListRepository boardListRepository;
    private final BoardAccessGuard accessGuard;
    private final BoardEventPublisher eventPublisher;
    private final ApplicationEventPublisher applicationEventPublisher;

    @Transactional
    public CardResponse createCard(UUID boardId, UUID listId, CreateCardRequest request, UserPrincipal principal) {
        accessGuard.assertMember(boardId, principal.getId());
        BoardList list = requireListOnBoard(listId, boardId);

        double position = cardRepository.findFirstByListIdOrderByPositionDesc(listId)
                .map(card -> card.getPosition() + POSITION_STEP)
                .orElse(POSITION_STEP);

        Card card = cardRepository.save(Card.builder()
                .list(list)
                .title(request.title().trim())
                .description(request.description())
                .priority(request.effectivePriority())
                .position(position)
                .build());

        publishActivity(boardId, principal, ActivityType.CARD_CREATED, card.getId(),
                principal.getDisplayName() + " added \"" + card.getTitle() + "\" to " + list.getName());
        eventPublisher.broadcast(boardId, EventType.CARD_CREATED, CardStateEvent.fromCard(card));

        return CardResponse.from(card);
    }

    @Transactional
    public CardResponse updateCard(UUID boardId, UUID cardId, UpdateCardRequest request, UserPrincipal principal) {
        accessGuard.assertMember(boardId, principal.getId());
        Card card = requireCardOnBoard(cardId, boardId);

        if (request.title() != null && !request.title().isBlank()) {
            card.setTitle(request.title().trim());
        }
        if (request.description() != null) {
            card.setDescription(request.description());
        }
        if (request.priority() != null) {
            card.setPriority(request.priority());
        }
        Card saved = cardRepository.saveAndFlush(card);

        publishActivity(boardId, principal, ActivityType.CARD_UPDATED, cardId,
                principal.getDisplayName() + " updated \"" + saved.getTitle() + "\"");
        eventPublisher.broadcast(boardId, EventType.CARD_UPDATED, CardStateEvent.fromCard(saved));

        return CardResponse.from(saved);
    }

    /**
     * Drag-and-drop move: reassigns the card's list and computes a fractional
     * position at the requested slot (never re-indexing sibling cards).
     */
    @Transactional
    public CardResponse moveCard(UUID boardId, UUID cardId, MoveCardRequest request, UserPrincipal principal) {
        accessGuard.assertMember(boardId, principal.getId());
        Card card = requireCardOnBoard(cardId, boardId);
        BoardList targetList = requireListOnBoard(request.toListId(), boardId);

        UUID fromListId = card.getList().getId();
        boolean sameList = fromListId.equals(targetList.getId());

        List<Card> siblings = cardRepository.findByListIdOrderByPositionAsc(targetList.getId()).stream()
                .filter(c -> !c.getId().equals(cardId))
                .toList();

        int targetIndex = request.targetIndex() == null
                ? siblings.size()
                : Math.max(0, Math.min(request.targetIndex(), siblings.size()));

        double newPosition = fractionalPosition(
                siblings.stream().map(Card::getPosition).toList(), targetIndex);

        card.setList(targetList);
        card.setPosition(newPosition);
        Card saved = cardRepository.saveAndFlush(card); // flush bumps @Version

        eventPublisher.broadcast(boardId, EventType.CARD_MOVED, new CardMoveEvent(
                saved.getId(), fromListId, targetList.getId(), saved.getPosition(),
                principal.getId(), saved.getVersion()));

        String targetDescription = sameList
                ? "within " + targetList.getName()
                : "to " + targetList.getName();
        publishActivity(boardId, principal, ActivityType.CARD_MOVED, cardId,
                principal.getDisplayName() + " moved \"" + saved.getTitle() + "\" " + targetDescription);

        return CardResponse.from(saved);
    }

    @Transactional
    public void deleteCard(UUID boardId, UUID cardId, UserPrincipal principal) {
        accessGuard.assertMember(boardId, principal.getId());
        Card card = requireCardOnBoard(cardId, boardId);

        UUID listId = card.getList().getId();
        String title = card.getTitle();
        cardRepository.delete(card);

        publishActivity(boardId, principal, ActivityType.CARD_DELETED, cardId,
                principal.getDisplayName() + " deleted \"" + title + "\"");
        eventPublisher.broadcast(boardId, EventType.CARD_DELETED, new CardDeletedEvent(cardId, listId));
    }

    // ---- helpers ----

    private Card requireCardOnBoard(UUID cardId, UUID boardId) {
        Card card = cardRepository.findById(cardId)
                .orElseThrow(() -> new ResourceNotFoundException("Card not found: " + cardId));
        if (!card.getList().getBoard().getId().equals(boardId)) {
            throw new ResourceNotFoundException("Card " + cardId + " does not belong to board " + boardId);
        }
        return card;
    }

    private BoardList requireListOnBoard(UUID listId, UUID boardId) {
        BoardList list = boardListRepository.findById(listId)
                .orElseThrow(() -> new ResourceNotFoundException("List not found: " + listId));
        if (!list.getBoard().getId().equals(boardId)) {
            throw new ResourceNotFoundException("List " + listId + " does not belong to board " + boardId);
        }
        return list;
    }

    private double fractionalPosition(List<Double> positions, int targetIndex) {
        if (positions.isEmpty()) {
            return POSITION_STEP;
        }
        if (targetIndex <= 0) {
            return positions.get(0) / 2.0;
        }
        if (targetIndex >= positions.size()) {
            return positions.get(positions.size() - 1) + POSITION_STEP;
        }
        return (positions.get(targetIndex - 1) + positions.get(targetIndex)) / 2.0;
    }

    private void publishActivity(UUID boardId, UserPrincipal actor, ActivityType type,
                                 UUID cardId, String message) {
        applicationEventPublisher.publishEvent(
                BoardActivityEvent.forCard(boardId, actor.getId(), actor.getDisplayName(), type, cardId, message));
    }
}
