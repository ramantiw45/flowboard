package com.taskboard.dto.auth;

public record AuthResponse(String token, String tokenType, UserResponse user) {

    public static AuthResponse bearer(String token, UserResponse user) {
        return new AuthResponse(token, "Bearer", user);
    }
}
