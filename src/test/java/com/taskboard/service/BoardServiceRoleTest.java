package com.taskboard.service;

import com.taskboard.board.Board;
import com.taskboard.board.BoardMember;
import com.taskboard.board.BoardMemberRepository;
import com.taskboard.board.BoardRepository;
import com.taskboard.board.MemberRole;
import com.taskboard.common.entity.BaseEntity;
import com.taskboard.common.exception.BadRequestException;
import com.taskboard.common.exception.ConflictException;
import com.taskboard.common.exception.ForbiddenException;
import com.taskboard.common.exception.ResourceNotFoundException;
import com.taskboard.dto.board.BoardMemberResponse;
import com.taskboard.dto.board.ChangeMemberRoleRequest;
import com.taskboard.dto.board.InviteMemberRequest;
import com.taskboard.security.UserPrincipal;
import com.taskboard.user.User;
import com.taskboard.user.UserRepository;
import com.taskboard.websocket.BoardEventPublisher;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Covers the role rules added when ADMIN became reachable. The audit found
 * that invites hard-coded MEMBER, which left the ADMIN branch of
 * {@link BoardAccessGuard#requireAdmin} as dead code. Making it reachable
 * means privilege escalation has to be fenced off deliberately:
 *
 * <ul>
 *   <li>an ADMIN must not be able to mint a peer ADMIN;</li>
 *   <li>OWNER must not be assignable at all, by invite or by role change;</li>
 *   <li>the board's own OWNER row must be immutable.</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class BoardServiceRoleTest {

    private static final UUID BOARD_ID = UUID.randomUUID();
    private static final UUID OWNER_ID = UUID.randomUUID();
    private static final UUID INVITEE_ID = UUID.randomUUID();

    @Mock private BoardRepository boardRepository;
    @Mock private BoardMemberRepository boardMemberRepository;
    @Mock private com.taskboard.list.BoardListRepository boardListRepository;
    @Mock private com.taskboard.card.CardRepository cardRepository;
    @Mock private UserRepository userRepository;
    @Mock private BoardAccessGuard accessGuard;
    @Mock private BoardEventPublisher eventPublisher;
    @Mock private ApplicationEventPublisher applicationEventPublisher;

    @InjectMocks private BoardService service;

    private UserPrincipal principal(UUID id, String name) {
        return new UserPrincipal(id, "u@example.com", name, "pw");
    }

    private BoardMember membership(UUID userId, MemberRole role) {
        User user = new User();
        user.setId(userId);
        user.setEmail(userId + "@example.com");
        user.setDisplayName("User " + userId.toString().substring(0, 4));
        return BoardMember.builder().board(new Board()).user(user).role(role).build();
    }

    private void denyOwner() {
        doThrow(new ForbiddenException("Only the board owner can change member roles"))
                .when(accessGuard).requireOwner(any(), any());
    }
    // ---------- invite ----------

    @Test
    @DisplayName("an invite with no role creates a MEMBER")
    void inviteDefaultsToMember() {
        User invitee = new User();
        invitee.setId(INVITEE_ID);
        invitee.setEmail("new@example.com");
        invitee.setDisplayName("New");

        when(boardRepository.getReferenceById(BOARD_ID)).thenReturn(new Board());
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.of(invitee));
        // The service re-reads the membership after the cascade save.
        when(boardMemberRepository.findByBoardIdAndUserId(BOARD_ID, INVITEE_ID))
                .thenReturn(Optional.of(membership(INVITEE_ID, MemberRole.MEMBER)));

        BoardMemberResponse response = service.inviteMember(BOARD_ID,
                new InviteMemberRequest("new@example.com", null), principal(OWNER_ID, "Owner"));

        ArgumentCaptor<Board> saved = ArgumentCaptor.forClass(Board.class);
        verify(boardRepository).save(saved.capture());
        assertThat(saved.getValue().getMembers())
                .singleElement()
                .extracting(BoardMember::getRole)
                .isEqualTo(MemberRole.MEMBER);
        assertThat(response.role()).isEqualTo("MEMBER");
    }

    @Test
    @DisplayName("an ADMIN cannot invite somebody as ADMIN")
    void adminCannotMintAdmin() {
        // requireAdmin passes for the admin, then requireOwner rejects.
        denyOwner();

        assertThatThrownBy(() -> service.inviteMember(BOARD_ID,
                new InviteMemberRequest("peer@example.com", MemberRole.ADMIN),
                principal(UUID.randomUUID(), "Admin")))
                .isInstanceOf(ForbiddenException.class);

        verifyNoInteractions(userRepository);
    }

    @Test
    @DisplayName("OWNER cannot be granted through an invite")
    void inviteRejectsOwnerRole() {
        assertThatThrownBy(() -> service.inviteMember(BOARD_ID,
                new InviteMemberRequest("new@example.com", MemberRole.OWNER),
                principal(OWNER_ID, "Owner")))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("OWNER");

        verifyNoInteractions(userRepository, boardMemberRepository);
    }


    // ---------- role change ----------

    @Test
    @DisplayName("the owner can promote a member to ADMIN")
    void ownerPromotesMember() {
        BoardMember target = membership(INVITEE_ID, MemberRole.MEMBER);
        when(boardMemberRepository.findByBoardIdAndUserId(BOARD_ID, INVITEE_ID)).thenReturn(Optional.of(target));

        BoardMemberResponse response = service.changeMemberRole(BOARD_ID, INVITEE_ID,
                new ChangeMemberRoleRequest(MemberRole.ADMIN), principal(OWNER_ID, "Owner"));

        assertThat(target.getRole()).isEqualTo(MemberRole.ADMIN);
        assertThat(response.role()).isEqualTo("ADMIN");
        verify(boardMemberRepository).save(target);
    }

    @Test
    @DisplayName("a non-owner cannot change roles at all")
    void nonOwnerCannotChangeRoles() {
        denyOwner();

        assertThatThrownBy(() -> service.changeMemberRole(BOARD_ID, INVITEE_ID,
                new ChangeMemberRoleRequest(MemberRole.ADMIN), principal(UUID.randomUUID(), "Admin")))
                .isInstanceOf(ForbiddenException.class);

        verifyNoInteractions(boardMemberRepository);
    }

    @Test
    @DisplayName("the board owner's own role is immutable")
    void ownerRowIsImmutable() {
        BoardMember ownerRow = membership(OWNER_ID, MemberRole.OWNER);
        when(boardMemberRepository.findByBoardIdAndUserId(BOARD_ID, OWNER_ID)).thenReturn(Optional.of(ownerRow));

        assertThatThrownBy(() -> service.changeMemberRole(BOARD_ID, OWNER_ID,
                new ChangeMemberRoleRequest(MemberRole.MEMBER), principal(OWNER_ID, "Owner")))
                .isInstanceOf(ConflictException.class);

        assertThat(ownerRow.getRole()).isEqualTo(MemberRole.OWNER);
        verify(boardMemberRepository, never()).save(any());
    }

    @Test
    @DisplayName("ownership transfer is rejected as a bad request")
    void ownershipTransferRejected() {
        assertThatThrownBy(() -> service.changeMemberRole(BOARD_ID, INVITEE_ID,
                new ChangeMemberRoleRequest(MemberRole.OWNER), principal(OWNER_ID, "Owner")))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("changing a role for a non-member is a 404")
    void unknownTargetIs404() {
        when(boardMemberRepository.findByBoardIdAndUserId(BOARD_ID, INVITEE_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.changeMemberRole(BOARD_ID, INVITEE_ID,
                new ChangeMemberRoleRequest(MemberRole.ADMIN), principal(OWNER_ID, "Owner")))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("setting the role it already has is a no-op, not a write")
    void sameRoleIsNoOp() {
        BoardMember target = membership(INVITEE_ID, MemberRole.ADMIN);
        when(boardMemberRepository.findByBoardIdAndUserId(BOARD_ID, INVITEE_ID)).thenReturn(Optional.of(target));

        BoardMemberResponse response = service.changeMemberRole(BOARD_ID, INVITEE_ID,
                new ChangeMemberRoleRequest(MemberRole.ADMIN), principal(OWNER_ID, "Owner"));

        assertThat(response.role()).isEqualTo("ADMIN");
        verify(boardMemberRepository, never()).save(any());
    }
}

