package com.taskboard.common.exception;

import org.springframework.http.HttpStatus;

/**
 * 400 - the request is well-formed but semantically unacceptable, e.g. asking
 * for a role that is not assignable through that endpoint. Distinct from the
 * framework-level 400s (unparseable body, bad path variable) because it is
 * raised deliberately by a service after it understood the request.
 */
public class BadRequestException extends ApiException {

    public BadRequestException(String message) {
        super(HttpStatus.BAD_REQUEST, message);
    }
}