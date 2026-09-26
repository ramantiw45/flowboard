package com.taskboard.list;

import com.taskboard.board.Board;
import com.taskboard.card.Card;
import com.taskboard.common.entity.BaseEntity;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

/**
 * A column/list on a board (e.g. To Do, In Progress, Done).
 * Named BoardList because "List" is a reserved SQL word and a Java type.
 *
 * Position uses fractional ordering (see V1__init.sql): reordering never
 * requires re-indexing sibling rows. {@code @Version} guards against lost
 * updates when two users edit the same list concurrently.
 */
@Entity
@Table(name = "board_lists")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BoardList extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "board_id", nullable = false)
    private Board board;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(nullable = false)
    private double position;

    @Version
    private long version;

    @OneToMany(mappedBy = "list", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC")
    @Builder.Default
    private List<Card> cards = new ArrayList<>();

    public void addCard(Card card) {
        this.cards.add(card);
        card.setList(this);
    }
}
