package com.taskboard.dto.activity;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.util.List;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The activity feed's paging contract used to be implied by Spring's
 * {@code PageImpl} JSON, so the client derived "is there more?" from
 * {@code last}. These pin the explicit {@link ActivityPageResponse} shape
 * instead, which is what the client actually depends on now.
 */
class ActivityPageResponseTest {

    private ActivityLogResponse row(int i) {
        return new ActivityLogResponse(
                java.util.UUID.randomUUID(), "actor", "Actor " + i,
                "CARD_CREATED", null, "row " + i, java.time.Instant.now());
    }

    private PageImpl<ActivityLogResponse> page(int number, int size, int total) {
        List<ActivityLogResponse> content = IntStream.range(0, Math.min(size, Math.max(0, total - number * size)))
                .mapToObj(this::row)
                .toList();
        return new PageImpl<>(content, PageRequest.of(number, size), total);
    }

    @Test
    @DisplayName("a middle page reports more and names the next index")
    void middlePage() {
        ActivityPageResponse response = ActivityPageResponse.from(page(0, 30, 44));

        assertThat(response.items()).hasSize(30);
        assertThat(response.hasMore()).isTrue();
        assertThat(response.nextPage()).isEqualTo(1);
        assertThat(response.total()).isEqualTo(44);
    }

    @Test
    @DisplayName("the last page reports no more and a null next index")
    void lastPage() {
        ActivityPageResponse response = ActivityPageResponse.from(page(1, 30, 44));

        assertThat(response.items()).hasSize(14);
        assertThat(response.hasMore()).isFalse();
        assertThat(response.nextPage()).isNull();
    }

    @Test
    @DisplayName("a page past the end is empty and still terminal, so the client stops")
    void pagePastTheEnd() {
        ActivityPageResponse response = ActivityPageResponse.from(page(2, 30, 44));

        assertThat(response.items()).isEmpty();
        assertThat(response.hasMore()).isFalse();
        assertThat(response.nextPage()).isNull();
    }

    @Test
    @DisplayName("an exactly-full board does not ask for a page that does not exist")
    void exactMultipleOfPageSize() {
        ActivityPageResponse response = ActivityPageResponse.from(page(0, 30, 30));

        assertThat(response.hasMore()).isFalse();
        assertThat(response.nextPage()).isNull();
    }
}
