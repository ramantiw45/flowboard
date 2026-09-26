package com.taskboard.board;

import com.taskboard.common.entity.BaseEntity;
import com.taskboard.list.BoardList;
import com.taskboard.user.User;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Entity
@Table(name = "boards")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Board extends BaseEntity {

    @Column(nullable = false, length = 120)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    /** Memberships (join rows) — the M:N link to users, each with a role. */
    @OneToMany(mappedBy = "board", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private Set<BoardMember> members = new HashSet<>();

    /** Ordered columns of the board (To Do, In Progress, Done, ...). */
    @OneToMany(mappedBy = "board", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC")
    @Builder.Default
    private List<BoardList> lists = new ArrayList<>();

    // ---- domain helpers (keep bidirectional relations consistent) ----

    public void addMember(User user, MemberRole role) {
        BoardMember membership = BoardMember.builder()
                .board(this)
                .user(user)
                .role(role)
                .build();
        this.members.add(membership);
    }

    public void removeMember(BoardMember membership) {
        this.members.remove(membership);
        membership.setBoard(null);
    }

    public void addList(BoardList list) {
        this.lists.add(list);
        list.setBoard(this);
    }
}
