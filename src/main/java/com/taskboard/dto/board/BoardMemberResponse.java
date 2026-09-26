package com.taskboard.dto.board;

import com.taskboard.board.BoardMember;

public record BoardMemberResponse(
        String userId,
        String email,
        String displayName,
        String role) {

    public static BoardMemberResponse from(BoardMember membership) {
        return new BoardMemberResponse(
                membership.getUser().getId().toString(),
                membership.getUser().getEmail(),
                membership.getUser().getDisplayName(),
                membership.getRole().name());
    }
}
