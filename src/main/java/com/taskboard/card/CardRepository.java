package com.taskboard.card;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CardRepository extends JpaRepository<Card, UUID> {

    List<Card> findByListIdOrderByPositionAsc(UUID listId);

    List<Card> findByListIdInOrderByPositionAsc(Collection<UUID> listIds);

    Optional<Card> findFirstByListIdOrderByPositionDesc(UUID listId);
}
