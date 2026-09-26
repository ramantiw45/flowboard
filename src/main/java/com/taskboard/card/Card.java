package com.taskboard.card;

import com.taskboard.common.entity.BaseEntity;
import com.taskboard.list.BoardList;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A task card. Belongs to exactly one {@link BoardList}; moving a card
 * between lists = changing {@code list} + recomputing {@code position}
 * (fractional midpoint of the target slot) in a single transaction.
 *
 * {@code @Version} provides optimistic locking: if two users drag the same
 * card at once, the second commit fails with OptimisticLockException and the
 * WebSocket layer reconciles clients with the authoritative state.
 */
@Entity
@Table(name = "cards")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Card extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "list_id", nullable = false)
    private BoardList list;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private CardPriority priority = CardPriority.MEDIUM;

    /** Fractional order index within the owning list (see V1__init.sql). */
    @Column(nullable = false)
    private double position;

    @Version
    private long version;
}
