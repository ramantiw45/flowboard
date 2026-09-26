package com.taskboard.service;

import com.taskboard.board.BoardMember;
import com.taskboard.board.BoardMemberRepository;
import com.taskboard.board.MemberRole;
import com.taskboard.common.exception.ForbiddenException;
import com.taskboard.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Central board-level access control. Every board-scoped REST/WebSocket
 * operation funnels through here: the requesting user must be an active
 * member of the target board, and role-restricted operations additionally
 * require OWNER or ADMIN.
 */
@Component
@RequiredArgsConstructor
public class BoardAccessGuard {

    private final BoardMemberRepository boardMemberRepository;

    /** @return the caller's membership, or 404 (unknown board) / 403 (not a member). */
    public BoardMember requireMembership(UUID boardId, UUID userId) {
        BoardMember membership = boardMemberRepository.findByBoardIdAndUserId(boardId, userId)
                .orElseThrow(() -> new ForbiddenException(
                        "You are not a member of board " + boardId));
        return membership;
    }

    /** Requires the caller to be OWNER or ADMIN (e.g. inviting members, deleting lists). */
    public BoardMember requireAdmin(UUID boardId, UUID userId) {
        BoardMember membership = requireMembership(boardId, userId);
        if (membership.getRole() != MemberRole.OWNER && membership.getRole() != MemberRole.ADMIN) {
            throw new ForbiddenException("OWNER or ADMIN role required for this operation");
        }
        return membership;
    }

    /**
     * Requires the caller to be the board OWNER. Used for privilege changes:
     * an ADMIN may invite colleagues as MEMBER, but only the OWNER may mint or
     * revoke another ADMIN, otherwise an ADMIN could escalate a peer (or
     * themselves via a second account) above the owner's intent.
     */
    public BoardMember requireOwner(UUID boardId, UUID userId) {
        BoardMember membership = requireMembership(boardId, userId);
        if (membership.getRole() != MemberRole.OWNER) {
            throw new ForbiddenException("Only the board owner can change member roles");
        }
        return membership;
    }

    /** Convenience for controllers that just need a 403/404 check. */
    public void assertMember(UUID boardId, UUID userId) {
        requireMembership(boardId, userId);
    }
}
