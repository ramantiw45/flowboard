package com.taskboard.board;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BoardMemberRepository extends JpaRepository<BoardMember, UUID> {

    Optional<BoardMember> findByBoardIdAndUserId(UUID boardId, UUID userId);

    boolean existsByBoardIdAndUserId(UUID boardId, UUID userId);

    List<BoardMember> findByBoardId(UUID boardId);
}
