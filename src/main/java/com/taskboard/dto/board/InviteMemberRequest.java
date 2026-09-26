package com.taskboard.dto.board;

import com.taskboard.board.MemberRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * @param role optional target role; defaults to MEMBER. OWNER is never
 *             assignable through an invite - board ownership is transferred
 *             out of band, not granted by invitation.
 */
public record InviteMemberRequest(
        @NotBlank @Email String email,
        MemberRole role) {

    public MemberRole roleOrDefault() {
        return role == null ? MemberRole.MEMBER : role;
    }
}
