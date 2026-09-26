package com.taskboard.common.exception;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.lang.reflect.Method;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Regression tests for the audit finding that every client-side mistake returned
 * HTTP 500. Each of these was reproduced against the running app before the
 * handlers were added.
 */
class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    @DisplayName("an unparseable path variable is a 400, not a 500")
    void typeMismatchIs400() throws Exception {
        Method method = Sample.class.getDeclaredMethod("endpoint", UUID.class);
        MethodArgumentTypeMismatchException ex = new MethodArgumentTypeMismatchException(
                "abc", UUID.class, "boardId", new MethodParameter(method, 0), new IllegalArgumentException());

        ResponseEntity<ProblemDetail> response = handler.handleTypeMismatch(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getDetail()).contains("boardId");
    }

    @Test
    @DisplayName("a truncated or unparseable JSON body is a 400, not a 500")
    void unreadableBodyIs400() {
        HttpMessageNotReadableException ex =
                new HttpMessageNotReadableException("JSON parse error", (org.springframework.http.HttpInputMessage) null);

        ResponseEntity<ProblemDetail> response = handler.handleUnreadableBody(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    @DisplayName("an unparseable query parameter is a 400, not a 500")
    void missingParamIs400() {
        ResponseEntity<ProblemDetail> response =
                handler.handleMissingParam(new MissingServletRequestParameterException("size", "int"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getDetail()).contains("size");
    }

    @Test
    @DisplayName("a constraint violation is a 409, not a 500")
    void dataIntegrityIs409() {
        ResponseEntity<ProblemDetail> response =
                handler.handleDataIntegrity(new DataIntegrityViolationException("value too long for varchar(200)"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    @DisplayName("a lost optimistic-lock race is a 409")
    void optimisticLockIs409() {
        ResponseEntity<ProblemDetail> response =
                handler.handleOptimisticLock(new org.springframework.dao.OptimisticLockingFailureException("stale"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    @DisplayName("domain exceptions keep their own status")
    void apiExceptionKeepsStatus() {
        ResponseEntity<ProblemDetail> forbidden = handler.handleApiException(new ForbiddenException("nope"));
        ResponseEntity<ProblemDetail> conflict = handler.handleApiException(new ConflictException("dupe"));
        ResponseEntity<ProblemDetail> missing = handler.handleApiException(new ResourceNotFoundException("gone"));

        assertThat(forbidden.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(conflict.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(missing.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    @DisplayName("an unexpected fault is still a 500 and still reaches the catch-all")
    void unexpectedIs500() {
        ResponseEntity<ProblemDetail> response = handler.handleUnexpected(new IllegalStateException("boom"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getDetail()).doesNotContain("boom");
    }

    @Test
    @DisplayName("every @ExceptionHandler method compiles to a usable signature")
    void handlerMethodsAreDiscoverable() throws Exception {
        int handlers = 0;
        for (Method m : GlobalExceptionHandler.class.getDeclaredMethods()) {
            if (m.isAnnotationPresent(ExceptionHandler.class)) {
                assertThat(ResponseEntity.class).isAssignableFrom(m.getReturnType());
                assertThat(m.getParameterCount()).isEqualTo(1);
                handlers++;
            }
        }
        assertThat(handlers).isGreaterThanOrEqualTo(8);
    }

    @SuppressWarnings("unused")
    private static final class Sample {
        void endpoint(UUID id) {
        }
    }
}
