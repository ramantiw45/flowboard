package com.taskboard.common.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Maps exceptions to RFC 7807 ProblemDetail responses.
 *
 * <p>Client-caused problems (malformed bodies, unparseable path variables or
 * query params, constraint violations) are mapped to 4xx and logged at
 * {@code warn}/{@code debug}. They must not fall through to the catch-all,
 * which returned 500 and logged a full stack trace for ordinary bad input.
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ProblemDetail> handleApiException(ApiException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(ex.getStatus(), ex.getMessage());
        return ResponseEntity.status(ex.getStatus()).body(problem);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ProblemDetail> handleAccessDenied(AccessDeniedException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.FORBIDDEN, "Access denied");
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(problem);
    }

    /** Failed sign-in (bad credentials, disabled account). Never leak which part was wrong. */
    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ProblemDetail> handleAuthentication(AuthenticationException ex) {
        log.info("Authentication failed: {}", ex.getMessage());
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.UNAUTHORIZED, "Invalid email or password");
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(problem);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ProblemDetail> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            fieldErrors.putIfAbsent(error.getField(), error.getDefaultMessage());
        }
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Validation failed");
        problem.setProperty("errors", fieldErrors);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(problem);
    }

    /**
     * Malformed or unreadable request bodies: truncated JSON, a bad enum value,
     * a type that will not coerce. These are 400s, not server faults.
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ProblemDetail> handleUnreadableBody(HttpMessageNotReadableException ex) {
        log.debug("Rejected unreadable request body: {}", ex.getMostSpecificCause().getMessage());
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.BAD_REQUEST, "Malformed or unreadable request body");
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(problem);
    }

    /** e.g. GET /api/boards/not-a-uuid or ?size=abc. */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ProblemDetail> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        log.debug("Rejected type mismatch for parameter '{}': {}", ex.getName(), ex.getValue());
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.BAD_REQUEST, "Invalid value for parameter '" + ex.getName() + "'");
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(problem);
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ProblemDetail> handleMissingParam(MissingServletRequestParameterException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.BAD_REQUEST, "Missing required parameter '" + ex.getParameterName() + "'");
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(problem);
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<ProblemDetail> handleMethodValidation(HandlerMethodValidationException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Validation failed");
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(problem);
    }


    /**
     * Lost optimistic-lock race (two users edited/moved the same card). Clients
     * resync via WebSocket.
     */
    @ExceptionHandler(OptimisticLockingFailureException.class)
    public ResponseEntity<ProblemDetail> handleOptimisticLock(OptimisticLockingFailureException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.CONFLICT, "Concurrent modification detected — refresh the board state.");
        return ResponseEntity.status(HttpStatus.CONFLICT).body(problem);
    }

    /**
     * A uniqueness or length constraint was violated (for example a concurrent
     * duplicate signup, or an invite racing past the pre-check). The
     * transaction is rolled back, so this is a client-visible conflict rather
     * than a server fault.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ProblemDetail> handleDataIntegrity(DataIntegrityViolationException ex) {
        log.debug("Data integrity violation: {}", ex.getMostSpecificCause().getMessage());
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.CONFLICT, "The request conflicts with existing data.");
        return ResponseEntity.status(HttpStatus.CONFLICT).body(problem);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ProblemDetail> handleUnexpected(Exception ex) {
        log.error("Unhandled exception", ex);
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred");
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(problem);
    }
}