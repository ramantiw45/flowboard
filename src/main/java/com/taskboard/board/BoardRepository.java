package com.taskboard.board;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BoardRepository extends JpaRepository<Board, UUID> {

    /** All boards (owned or shared) visible to a given user. */
    @Query("""
            select distinct b from Board b
            join b.members m
            where m.user.id = :userId
            order by b.updatedAt desc
            """)
    List<Board> findAllVisibleToUser(@Param("userId") UUID userId);

    boolean existsByIdAndMembersUserId(UUID id, UUID userId);

    /** Board with its lists eagerly fetched (single query, ordered in the service). */
    @Query("""
            select distinct b from Board b
            left join fetch b.lists
            where b.id = :id
            """)
    Optional<Board> findByIdWithLists(@Param("id") UUID id);
}
