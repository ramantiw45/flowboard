package com.taskboard.dto.list;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateListRequest(
        @NotBlank @Size(min = 1, max = 120) String name) {
}
