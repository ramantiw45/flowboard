package com.taskboard.web;

import com.taskboard.dto.activity.ActivityLogResponse;
import com.taskboard.security.UserPrincipal;
import com.taskboard.service.BoardAccessGuard;
import com.taskboard.activity.ActivityLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
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

    private final ActivityLogRepository activityLogRepository;
    private final BoardAccessGuard accessGuard;

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<Page<ActivityLogResponse>> getActivity(@PathVariable UUID boardId,
                                                                 @RequestParam(defaultValue = "0") int page,
                                                                 @RequestParam(defaultValue = "20") int size,
                                                                 @AuthenticationPrincipal UserPrincipal principal) {
        accessGuard.assertMember(boardId, principal.getId());
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(100, Math.max(1, size)));
        Page<ActivityLogResponse> result = activityLogRepository
                .findByBoardIdOrderByCreatedAtDesc(boardId, pageable)
                .map(ActivityLogResponse::from);
        return ResponseEntity.ok(result);
    }
}
