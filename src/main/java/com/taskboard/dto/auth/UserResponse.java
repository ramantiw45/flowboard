package com.taskboard.dto.auth;

import com.taskboard.user.User;

import java.time.Instant;
import java.util.UUID;

public record UserResponse(UUID id, String email, String displayName, Instant createdAt) {

    public static UserResponse from(User user) {
        return new UserResponse(user.getId(), user.getEmail(), user.getDisplayName(), user.getCreatedAt());
    }
}
