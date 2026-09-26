package com.taskboard.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;

/**
 * The CSRF cookie repository, as a bean that both the filter chain and
 * {@link CsrfCookieFilter} can share.
 *
 * <p>It has to be shared, not merely duplicated. {@code CsrfConfigurer} builds
 * its own repository internally and does not publish it, so this bean exists to
 * give the cookie writer and the token checker the same instance - two separate
 * repositories would mean the value the client echoes back was compared against
 * an unrelated token, and every write would fail.
 *
 * <p>It lives in its own class rather than in {@code SecurityConfig} because
 * {@code CsrfCookieFilter} depends on it and {@code SecurityConfig} depends on
 * the filter; declaring the bean in {@code SecurityConfig} would make that a
 * cycle. Verified: the app failed to start with
 * "Requested bean is currently in creation".
 *
 * <p>{@code HttpOnly} is deliberately off. The double-submit pattern requires
 * the client to read this cookie and echo it in the {@code X-XSRF-TOKEN} header.
 * This is a different cookie from the session, which remains {@code HttpOnly}.
 */
@Configuration(proxyBeanMethods = false)
public class CsrfConfig {

    @Bean
    public CookieCsrfTokenRepository csrfTokenRepository() {
        return CookieCsrfTokenRepository.withHttpOnlyFalse();
    }
}