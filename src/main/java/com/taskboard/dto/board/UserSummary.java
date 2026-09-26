package com.taskboard.dto.board;

import java.util.UUID;

public record UserSummary(UUID id, String displayName) {

    public static UserSummary from(com.taskboard.user.User user) {
        return new UserSummary(user.getId(), user.getDisplayName());
    }
}
