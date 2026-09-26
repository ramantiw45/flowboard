package com.taskboard.web;

import com.taskboard.dto.list.CreateListRequest;
import com.taskboard.dto.list.ListResponse;
import com.taskboard.dto.list.MoveListRequest;
import com.taskboard.dto.list.RenameListRequest;
import com.taskboard.security.UserPrincipal;
import com.taskboard.service.BoardListService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/boards/{boardId}/lists")
@RequiredArgsConstructor
public class BoardListController {

    private final BoardListService boardListService;

    @PostMapping
    public ResponseEntity<ListResponse> createList(@PathVariable UUID boardId,
                                                   @Valid @RequestBody CreateListRequest request,
                                                   @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(boardListService.createList(boardId, request, principal));
    }

    @PatchMapping("/{listId}")
    public ResponseEntity<ListResponse> renameList(@PathVariable UUID boardId,
                                                   @PathVariable UUID listId,
                                                   @Valid @RequestBody RenameListRequest request,
                                                   @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(boardListService.renameList(boardId, listId, request, principal));
    }

    @PatchMapping("/{listId}/move")
    public ResponseEntity<ListResponse> moveList(@PathVariable UUID boardId,
                                                 @PathVariable UUID listId,
                                                 @Valid @RequestBody MoveListRequest request,
                                                 @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(boardListService.moveList(boardId, listId, request, principal));
    }

    @DeleteMapping("/{listId}")
    public ResponseEntity<Void> deleteList(@PathVariable UUID boardId,
                                           @PathVariable UUID listId,
                                           @AuthenticationPrincipal UserPrincipal principal) {
        boardListService.deleteList(boardId, listId, principal);
        return ResponseEntity.noContent().build();
    }
}
