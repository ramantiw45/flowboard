package com.taskboard.board;

import com.taskboard.common.entity.BaseEntity;
import com.taskboard.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Join entity for the many-to-many relationship between {@link User} and
 * {@link Board}, carrying the per-membership role. Uniqueness of
 * (board_id, user_id) is enforced both here and in the database.
 */
@Entity
@Table(
        name = "board_members",
        uniqueConstraints = @UniqueConstraint(name = "uq_board_member", columnNames = {"board_id", "user_id"})
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BoardMember extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "board_id", nullable = false)
    private Board board;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MemberRole role;
}
