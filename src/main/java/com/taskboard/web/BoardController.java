package com.taskboard.web;

import com.taskboard.dto.board.BoardMemberResponse;
import com.taskboard.dto.board.BoardResponse;
import com.taskboard.dto.board.BoardSummary;
import com.taskboard.dto.board.ChangeMemberRoleRequest;
import com.taskboard.dto.board.CreateBoardRequest;
import com.taskboard.dto.board.InviteMemberRequest;
import com.taskboard.security.UserPrincipal;
import com.taskboard.service.BoardService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/boards")
@RequiredArgsConstructor
public class BoardController {

    private final BoardService boardService;

    @PostMapping
    public ResponseEntity<BoardSummary> createBoard(@Valid @RequestBody CreateBoardRequest request,
                                                    @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.status(HttpStatus.CREATED).body(boardService.createBoard(request, principal));
    }

    @GetMapping
    public ResponseEntity<List<BoardSummary>> getBoards(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(boardService.getBoardsForUser(principal));
    }

    @GetMapping("/{boardId}")
    public ResponseEntity<BoardResponse> getBoard(@PathVariable UUID boardId,
                                                  @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(boardService.getBoard(boardId, principal));
    }

    @GetMapping("/{boardId}/members")
    public ResponseEntity<List<BoardMemberResponse>> getMembers(@PathVariable UUID boardId,
                                                                @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(boardService.getMembers(boardId, principal));
    }

    @PostMapping("/{boardId}/members")
    public ResponseEntity<BoardMemberResponse> inviteMember(@PathVariable UUID boardId,
                                                            @Valid @RequestBody InviteMemberRequest request,
                                                            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.status(HttpStatus.CREATED).body(boardService.inviteMember(boardId, request, principal));
    }

    @PatchMapping("/{boardId}/members/{userId}/role")
    public ResponseEntity<BoardMemberResponse> changeMemberRole(@PathVariable UUID boardId,
                                                                @PathVariable UUID userId,
                                                                @Valid @RequestBody ChangeMemberRoleRequest request,
                                                                @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(boardService.changeMemberRole(boardId, userId, request, principal));
    }
}
