package com.taskboard.dto.board;

import com.taskboard.board.MemberRole;
import jakarta.validation.constraints.NotNull;

/** Target role for PATCH /api/boards/{boardId}/members/{userId}/role. */
public record ChangeMemberRoleRequest(@NotNull MemberRole role) {
}