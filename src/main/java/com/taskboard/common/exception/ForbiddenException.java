package com.taskboard.common.exception;

import org.springframework.http.HttpStatus;

/** 403 — the user is authenticated but not a member (or lacks the role) of the target board. */
public class ForbiddenException extends ApiException {

    public ForbiddenException(String message) {
        super(HttpStatus.FORBIDDEN, message);
    }
}
