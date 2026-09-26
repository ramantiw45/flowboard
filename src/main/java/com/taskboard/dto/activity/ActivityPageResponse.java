package com.taskboard.dto.activity;

import org.springframework.data.domain.Page;

import java.util.List;
import java.util.UUID;

/**
 * Explicit page envelope for the activity feed.
 *
 * <p>This replaces serialising Spring's {@code Page} straight to JSON. The
 * client previously had to read {@code content} and {@code last}, which are
 * implementation details of {@code PageImpl}'s serialised form rather than a
 * contract: a Spring Data upgrade, a {@code @JsonIgnore} on the type, or a
 * switch to a cursor-based repository would silently change the wire shape and
 * the "load older" button would stop working. The client should depend on
 * field names this project owns.
 *
 * @param items    the rows on this page, newest first
 * @param hasMore  whether older rows exist behind this page
 * @param nextPage page index to request for the next batch, or null at the end
 * @param total    total rows for the board, so the client can show "1-30 of 44"
 */
public record ActivityPageResponse(
        List<ActivityLogResponse> items,
        boolean hasMore,
        Integer nextPage,
        long total) {

    /**
     * Wraps a Spring Data page. {@code hasMore} is derived from {@code !last}
     * because a page past the end is still {@code last=true} and simply empty;
     * that keeps the client from issuing one pointless extra request.
     */
    public static ActivityPageResponse from(Page<ActivityLogResponse> page) {
        boolean hasMore = !page.isLast();
        return new ActivityPageResponse(
                page.getContent(),
                hasMore,
                hasMore ? page.getNumber() + 1 : null,
                page.getTotalElements());
    }
}