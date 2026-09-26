package com.taskboard.common.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.time.Instant;
import java.util.UUID;

/**
 * Base entity for all domain objects: UUID primary key + audit timestamps.
 * UUIDs are generated application-side (Hibernate 6 @UuidGenerator) and map
 * natively to PostgreSQL's {@code uuid} column type.
 */
@MappedSuperclass
@Getter
@Setter
public abstract class BaseEntity {

    @Id
    @UuidGenerator
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
