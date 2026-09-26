package com.taskboard.user;

import com.taskboard.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "users")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User extends BaseEntity {

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "display_name", nullable = false, length = 100)
    private String displayName;

    /** BCrypt hash only — never the raw password. */
    @Column(name = "password_hash", nullable = false)
    private String passwordHash;
}
