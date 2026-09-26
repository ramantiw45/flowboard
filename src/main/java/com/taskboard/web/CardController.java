package com.taskboard.web;

import com.taskboard.dto.card.CardResponse;
import com.taskboard.dto.card.CreateCardRequest;
import com.taskboard.dto.card.MoveCardRequest;
import com.taskboard.dto.card.UpdateCardRequest;
import com.taskboard.security.UserPrincipal;
import com.taskboard.service.CardService;
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
@RequestMapping("/api/boards/{boardId}")
@RequiredArgsConstructor
public class CardController {

    private final CardService cardService;

    @PostMapping("/lists/{listId}/cards")
    public ResponseEntity<CardResponse> createCard(@PathVariable UUID boardId,
                                                   @PathVariable UUID listId,
                                                   @Valid @RequestBody CreateCardRequest request,
                                                   @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(cardService.createCard(boardId, listId, request, principal));
    }

    @PatchMapping("/cards/{cardId}")
    public ResponseEntity<CardResponse> updateCard(@PathVariable UUID boardId,
                                                   @PathVariable UUID cardId,
                                                   @Valid @RequestBody UpdateCardRequest request,
                                                   @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(cardService.updateCard(boardId, cardId, request, principal));
    }

    @PatchMapping("/cards/{cardId}/move")
    public ResponseEntity<CardResponse> moveCard(@PathVariable UUID boardId,
                                                 @PathVariable UUID cardId,
                                                 @Valid @RequestBody MoveCardRequest request,
                                                 @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(cardService.moveCard(boardId, cardId, request, principal));
    }

    @DeleteMapping("/cards/{cardId}")
    public ResponseEntity<Void> deleteCard(@PathVariable UUID boardId,
                                           @PathVariable UUID cardId,
                                           @AuthenticationPrincipal UserPrincipal principal) {
        cardService.deleteCard(boardId, cardId, principal);
        return ResponseEntity.noContent().build();
    }
}
