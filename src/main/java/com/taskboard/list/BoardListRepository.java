package com.taskboard.list;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BoardListRepository extends JpaRepository<BoardList, UUID> {

    List<BoardList> findByBoardIdOrderByPositionAsc(UUID boardId);

    Optional<BoardList> findFirstByBoardIdOrderByPositionDesc(UUID boardId);

    default Optional<BoardList> findLastListOnBoard(UUID boardId) {
        return findFirstByBoardIdOrderByPositionDesc(boardId);
    }
}
