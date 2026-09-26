package com.taskboard.dto.list;

import jakarta.validation.constraints.Min;

/**
 * targetIndex: 0-based slot among the board's lists; null/absent = move to end.
 *
 * <p>Bounded at 0 so a negative index is rejected as a 400 rather than being
 * silently clamped in the service.
 */
public record MoveListRequest(@Min(0) Integer targetIndex) {
}