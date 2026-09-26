package com.taskboard.dto.board;

import com.taskboard.dto.list.ListResponse;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Full board payload returned when opening a board. */
public record BoardResponse(
        UUID id,
        String name,
        List<ListResponse> lists,
        List<BoardMemberResponse> members,
        Instant createdAt,
        Instant updatedAt) {
}
