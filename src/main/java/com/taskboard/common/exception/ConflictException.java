package com.taskboard.common.exception;

import org.springframework.http.HttpStatus;

/** 409 — duplicate email, duplicate membership, concurrent modification, etc. */
public class ConflictException extends ApiException {

    public ConflictException(String message) {
        super(HttpStatus.CONFLICT, message);
    }
}
