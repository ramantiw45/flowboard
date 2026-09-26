package com.taskboard.dto.board;

import com.taskboard.board.Board;

import java.time.Instant;
import java.util.UUID;

/** Compact representation for board lists/dashboards. */
public record BoardSummary(UUID id, String name, String ownerName, Instant createdAt) {

    public static BoardSummary from(Board board) {
        return new BoardSummary(board.getId(), board.getName(),
                board.getOwner().getDisplayName(), board.getCreatedAt());
    }
}
