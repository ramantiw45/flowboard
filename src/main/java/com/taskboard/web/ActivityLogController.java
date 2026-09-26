package com.taskboard.web;

import com.taskboard.activity.ActivityLogService;
import com.taskboard.dto.activity.ActivityPageResponse;
import com.taskboard.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/boards/{boardId}/activity")
@RequiredArgsConstructor
public class ActivityLogController {

    private final ActivityLogService activityLogService;

    /**
     * Membership is enforced by {@link ActivityLogService#getActivityFeed},
     * which owns the query it guards; duplicating the check here would let the
     * two drift. The controller stays a thin translation of HTTP to service call.
     */
    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<ActivityPageResponse> getActivity(@PathVariable UUID boardId,
                                                            @RequestParam(defaultValue = "0") int page,
                                                            @RequestParam(defaultValue = "20") int size,
                                                            @AuthenticationPrincipal UserPrincipal principal) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(100, Math.max(1, size)));
        return ResponseEntity.ok(
                activityLogService.getActivityFeed(boardId, principal, pageable));
    }
}
