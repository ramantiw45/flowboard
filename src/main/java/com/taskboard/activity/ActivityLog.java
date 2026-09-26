package com.taskboard.activity;

import com.taskboard.board.Board;
import com.taskboard.card.Card;
import com.taskboard.common.entity.BaseEntity;
import com.taskboard.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

/**
 * Audit trail entry, e.g. "Alice moved 'Design login' to Done".
 * The FK to card is SET NULL on delete so history survives card removal
 * (enforced in the DB via @OnDelete; do not rely on JPA cascade here).
 */
@Entity
@Table(
        name = "activity_logs",
        indexes = @Index(name = "idx_activity_logs_board_created", columnList = "board_id, created_at DESC")
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ActivityLog extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "board_id", nullable = false)
    private Board board;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "actor_id", nullable = false)
    private User actor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "card_id")
    @OnDelete(action = OnDeleteAction.SET_NULL)
    private Card card;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ActivityType type;

    /** Human-readable message, e.g. "Alice moved 'Design login' to Done". */
    @Column(nullable = false, columnDefinition = "text")
    private String message;
}
