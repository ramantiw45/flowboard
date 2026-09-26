package com.taskboard.service;

import com.taskboard.activity.ActivityType;
import com.taskboard.activity.BoardActivityEvent;
import com.taskboard.board.BoardRepository;
import com.taskboard.common.exception.ResourceNotFoundException;
import com.taskboard.dto.list.CreateListRequest;
import com.taskboard.dto.list.ListResponse;
import com.taskboard.dto.list.MoveListRequest;
import com.taskboard.dto.list.RenameListRequest;
import com.taskboard.list.BoardList;
import com.taskboard.list.BoardListRepository;
import com.taskboard.security.UserPrincipal;
import com.taskboard.websocket.BoardEventPublisher;
import com.taskboard.websocket.event.EventType;
import com.taskboard.websocket.event.ListEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class BoardListService {

    private static final double POSITION_STEP = 1000.0;

    private final BoardListRepository boardListRepository;
    private final BoardRepository boardRepository;
    private final BoardAccessGuard accessGuard;
    private final BoardEventPublisher eventPublisher;
    private final ApplicationEventPublisher applicationEventPublisher;

    @Transactional
    public ListResponse createList(UUID boardId, CreateListRequest request, UserPrincipal principal) {
        accessGuard.assertMember(boardId, principal.getId());

        double position = boardListRepository.findLastListOnBoard(boardId)
                .map(list -> list.getPosition() + POSITION_STEP)
                .orElse(POSITION_STEP);

        BoardList list = boardListRepository.save(BoardList.builder()
                .board(boardRepository.getReferenceById(boardId))
                .name(request.name().trim())
                .position(position)
                .build());

        publishActivity(boardId, principal, ActivityType.LIST_CREATED,
                principal.getDisplayName() + " created list \"" + list.getName() + "\"");
        eventPublisher.broadcast(boardId, EventType.LIST_CREATED, ListEvent.fromList(list));

        return ListResponse.from(list, List.of());
    }

    @Transactional
    public ListResponse renameList(UUID boardId, UUID listId, RenameListRequest request, UserPrincipal principal) {
        accessGuard.assertMember(boardId, principal.getId());
        BoardList list = requireListOnBoard(listId, boardId);

        list.setName(request.name().trim());
        BoardList saved = boardListRepository.save(list);

        publishActivity(boardId, principal, ActivityType.LIST_RENAMED,
                principal.getDisplayName() + " renamed a list to \"" + saved.getName() + "\"");
        eventPublisher.broadcast(boardId, EventType.LIST_UPDATED, ListEvent.fromList(saved));

        return ListResponse.from(saved, saved.getCards());
    }

    @Transactional
    public ListResponse moveList(UUID boardId, UUID listId, MoveListRequest request, UserPrincipal principal) {
        accessGuard.assertMember(boardId, principal.getId());
        BoardList moved = requireListOnBoard(listId, boardId);

        List<BoardList> siblings = boardListRepository.findByBoardIdOrderByPositionAsc(boardId).stream()
                .filter(list -> !list.getId().equals(listId))
                .toList();

        int targetIndex = request.targetIndex() == null ? siblings.size() : Math.max(0, request.targetIndex());
        moved.setPosition(fractionalPosition(
                siblings.stream().map(BoardList::getPosition).toList(), targetIndex));
        BoardList saved = boardListRepository.saveAndFlush(moved);

        eventPublisher.broadcast(boardId, EventType.LIST_UPDATED, ListEvent.fromList(saved));
        return ListResponse.from(saved, saved.getCards());
    }

    @Transactional
    public void deleteList(UUID boardId, UUID listId, UserPrincipal principal) {
        accessGuard.requireAdmin(boardId, principal.getId());
        BoardList list = requireListOnBoard(listId, boardId);

        String name = list.getName();
        boardListRepository.delete(list);

        publishActivity(boardId, principal, ActivityType.LIST_DELETED,
                principal.getDisplayName() + " deleted list \"" + name + "\"");
        eventPublisher.broadcast(boardId, EventType.LIST_DELETED,
                new ListEvent(listId, null, null, null));
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

    private void publishActivity(UUID boardId, UserPrincipal actor, ActivityType type, String message) {
        applicationEventPublisher.publishEvent(
                BoardActivityEvent.of(boardId, actor.getId(), actor.getDisplayName(), type, message));
    }
}
