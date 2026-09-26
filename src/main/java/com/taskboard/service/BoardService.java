package com.taskboard.service;

import com.taskboard.activity.ActivityType;
import com.taskboard.activity.BoardActivityEvent;
import com.taskboard.board.Board;
import com.taskboard.board.BoardMember;
import com.taskboard.board.BoardMemberRepository;
import com.taskboard.board.BoardRepository;
import com.taskboard.board.MemberRole;
import com.taskboard.card.Card;
import com.taskboard.card.CardRepository;
import com.taskboard.common.exception.ConflictException;
import com.taskboard.common.exception.ResourceNotFoundException;
import com.taskboard.dto.board.BoardMemberResponse;
import com.taskboard.dto.board.BoardResponse;
import com.taskboard.dto.board.BoardSummary;
import com.taskboard.dto.board.CreateBoardRequest;
import com.taskboard.dto.board.InviteMemberRequest;
import com.taskboard.dto.list.ListResponse;
import com.taskboard.list.BoardList;
import com.taskboard.list.BoardListRepository;
import com.taskboard.security.UserPrincipal;
import com.taskboard.user.User;
import com.taskboard.user.UserRepository;
import com.taskboard.websocket.BoardEventPublisher;
import com.taskboard.websocket.event.EventType;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BoardService {

    private static final double POSITION_STEP = 1000.0;

    private final BoardRepository boardRepository;
    private final BoardMemberRepository boardMemberRepository;
    private final BoardListRepository boardListRepository;
    private final CardRepository cardRepository;
    private final UserRepository userRepository;
    private final BoardAccessGuard accessGuard;
    private final BoardEventPublisher eventPublisher;
    private final ApplicationEventPublisher applicationEventPublisher;

    @Transactional
    public BoardSummary createBoard(CreateBoardRequest request, UserPrincipal principal) {
        User owner = userRepository.getReferenceById(principal.getId());
        Board board = Board.builder().name(request.name().trim()).owner(owner).build();
        board.addMember(owner, MemberRole.OWNER);

        // Sensible default columns
        board.addList(BoardList.builder().name("To Do").position(POSITION_STEP).build());
        board.addList(BoardList.builder().name("In Progress").position(2 * POSITION_STEP).build());
        board.addList(BoardList.builder().name("Done").position(3 * POSITION_STEP).build());

        Board saved = boardRepository.save(board);
        publishActivity(saved.getId(), principal, ActivityType.BOARD_CREATED,
                principal.getDisplayName() + " created board \"" + saved.getName() + "\"");
        return BoardSummary.from(saved);
    }

    @Transactional(readOnly = true)
    public List<BoardSummary> getBoardsForUser(UserPrincipal principal) {
        return boardRepository.findAllVisibleToUser(principal.getId()).stream()
                .map(BoardSummary::from)
                .toList();
    }

    @Transactional
    public BoardResponse getBoard(UUID boardId, UserPrincipal principal) {
        accessGuard.assertMember(boardId, principal.getId());

        Board board = boardRepository.findByIdWithLists(boardId)
                .orElseThrow(() -> new ResourceNotFoundException("Board not found: " + boardId));

        List<BoardList> lists = board.getLists().stream()
                .sorted(Comparator.comparingDouble(BoardList::getPosition))
                .toList();

        Map<UUID, List<Card>> cardsByList = cardRepository
                .findByListIdInOrderByPositionAsc(lists.stream().map(BoardList::getId).toList())
                .stream()
                .collect(Collectors.groupingBy(card -> card.getList().getId(),
                        Collectors.mapping(Function.identity(), Collectors.toList())));

        List<ListResponse> listResponses = lists.stream()
                .map(list -> ListResponse.from(list, cardsByList.getOrDefault(list.getId(), List.of())))
                .toList();

        List<BoardMemberResponse> members = boardMemberRepository.findByBoardId(boardId).stream()
                .map(BoardMemberResponse::from)
                .toList();

        return new BoardResponse(board.getId(), board.getName(), listResponses, members,
                board.getCreatedAt(), board.getUpdatedAt());
    }

    @Transactional
    public BoardMemberResponse inviteMember(UUID boardId, InviteMemberRequest request, UserPrincipal principal) {
        accessGuard.requireAdmin(boardId, principal.getId());

        User invitee = userRepository.findByEmail(request.email().toLowerCase().trim())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No registered user with email " + request.email()));

        if (boardMemberRepository.existsByBoardIdAndUserId(boardId, invitee.getId())) {
            throw new ConflictException("User is already a member of this board");
        }

        Board board = boardRepository.getReferenceById(boardId);
        board.addMember(invitee, MemberRole.MEMBER);
        boardRepository.save(board);

        BoardMember membership = boardMemberRepository
                .findByBoardIdAndUserId(boardId, invitee.getId()).orElseThrow();

        publishActivity(boardId, principal, ActivityType.MEMBER_INVITED,
                principal.getDisplayName() + " invited " + invitee.getDisplayName() + " to the board");

        BoardMemberResponse response = BoardMemberResponse.from(membership);
        eventPublisher.broadcast(boardId, EventType.MEMBER_ADDED, response);
        return response;
    }

    @Transactional(readOnly = true)
    public List<BoardMemberResponse> getMembers(UUID boardId, UserPrincipal principal) {
        accessGuard.assertMember(boardId, principal.getId());
        return boardMemberRepository.findByBoardId(boardId).stream()
                .map(BoardMemberResponse::from)
                .toList();
    }

    private void publishActivity(UUID boardId, UserPrincipal actor, ActivityType type, String message) {
        applicationEventPublisher.publishEvent(
                BoardActivityEvent.of(boardId, actor.getId(), actor.getDisplayName(), type, message));
    }
}
