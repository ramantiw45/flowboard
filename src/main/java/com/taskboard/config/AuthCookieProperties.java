package com.taskboard.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Typed configuration for the auth cookies (see {@code app.auth} in
 * application.yml).
 *
 * @param cookieName        name of the access-token cookie
 * @param refreshCookieName name of the refresh-token cookie
 * @param secure            whether to set the {@code Secure} attribute. Defaults to
 *                          false so plain-http localhost development still works;
 *                          it must be true behind TLS, because a cookie sent without
 *                          {@code Secure} can be replayed over plain http.
 * @param sameSite          {@code SameSite} attribute for both cookies
 * @param refreshTtlDays    how long a refresh token stays usable
 * @param csrfHeaderName    request header carrying the CSRF token
 * @param csrfCookieName    readable cookie mirroring the CSRF token
 */
@ConfigurationProperties(prefix = "app.auth")
public record AuthCookieProperties(
        String cookieName,
        String refreshCookieName,
        boolean secure,
        String sameSite,
        long refreshTtlDays,
        String csrfHeaderName,
        String csrfCookieName) {

    public long refreshTtlMillis() {
        return refreshTtlDays * 24L * 60L * 60L * 1000L;
    }
}