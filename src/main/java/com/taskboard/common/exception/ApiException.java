package com.taskboard.common.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

/**
 * Base class for API exceptions carrying an HTTP status.
 */
@Getter
public class ApiException extends RuntimeException {

    private final HttpStatus status;

    protected ApiException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }
}
